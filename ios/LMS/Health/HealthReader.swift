import Foundation
import HealthKit

/// One day of totals, as POST /api/training/health takes it. The Android companion sends the
/// same fields (android/…/Payload.kt); LMS overwrites a day as it fills up.
struct DayValues {
    let date: String
    var steps: Double?
    /// Metres walked and run.
    var distance: Double?
    /// kcal burned moving.
    var activeEnergy: Double?
    /// kcal burned at rest.
    var restingEnergy: Double?
    var restingHeartRate: Double?
    /// Average bpm.
    var heartRate: Double?
    /// Heart rate variability (SDNN), ms.
    var hrv: Double?
    /// Minutes asleep, the night that ended this day.
    var sleep: Double?
    /// kg, the day's last weigh-in.
    var weight: Double?
    /// %.
    var bodyFat: Double?
    var vo2max: Double?

    /// The fields LMS gets, or nil for a day with nothing in it.
    var json: [String: Any]? {
        var out: [String: Any] = [:]
        func put(_ name: String, _ value: Double?, decimals: Bool = false) {
            guard let value, value.isFinite, value > 0 else { return }
            out[name] = decimals ? (value * 10).rounded() / 10 : Double(Int(value.rounded()))
        }
        put("steps", steps)
        put("distance", distance)
        put("activeEnergy", activeEnergy)
        put("restingEnergy", restingEnergy)
        put("restingHeartRate", restingHeartRate)
        put("heartRate", heartRate)
        put("hrv", hrv)
        put("sleep", sleep)
        put("weight", weight, decimals: true)
        put("bodyFat", bodyFat, decimals: true)
        put("vo2max", vo2max, decimals: true)
        guard !out.isEmpty else { return nil }
        out["date"] = date
        return out
    }
}

/// A workout recorded on the phone or the watch. LMS makes it a set once, by its id.
struct PhoneWorkout {
    let id: String
    /// Running, Walking, Cycling, Yoga…: LMS matches its own exercises by this name.
    let type: String
    let start: Date
    let end: Date
    /// Metres.
    let distance: Double?
    /// kcal.
    let energy: Double?

    var json: [String: Any] {
        var out: [String: Any] = [
            "id": id,
            "type": type,
            "start": Days.isoLocal(start),
            "end": Days.isoLocal(end),
        ]
        if let distance, distance > 0 { out["distance"] = Double(Int(distance.rounded())) }
        if let energy, energy > 0 { out["energy"] = Double(Int(energy.rounded())) }
        return out
    }
}

/// Reads Apple Health into days of totals and workouts; writes what was eaten back.
final class HealthReader {
    let store: HKHealthStore

    init(store: HKHealthStore) {
        self.store = store
    }

    /// What LMS reads. Each is asked for; whatever the person allows is read (HealthKit never
    /// says what was refused: a refused type simply reads as empty).
    static let quantityReads: [HKQuantityTypeIdentifier] = [
        .stepCount, .distanceWalkingRunning, .activeEnergyBurned, .basalEnergyBurned,
        .restingHeartRate, .heartRate, .heartRateVariabilitySDNN,
        .bodyMass, .bodyFatPercentage, .vo2Max,
    ]

    static var readTypes: Set<HKObjectType> {
        var types = Set<HKObjectType>(quantityReads.map { HKQuantityType($0) })
        types.insert(HKCategoryType(.sleepAnalysis))
        types.insert(HKObjectType.workoutType())
        return types
    }

    /// The one thing LMS writes: energy eaten, from the meals logged in LMS.
    static let dietaryEnergy = HKQuantityType(.dietaryEnergyConsumed)

    /// The last `days` days, today included.
    func read(days: Int) async -> ([DayValues], [PhoneWorkout]) {
        let calendar = Days.calendar
        let now = Date()
        let today = calendar.startOfDay(for: now)
        let first = calendar.date(byAdding: .day, value: -(days - 1), to: today) ?? today

        var byDay: [String: DayValues] = [:]
        var order: [String] = []
        for offset in 0..<days {
            guard let day = calendar.date(byAdding: .day, value: offset, to: first) else { continue }
            let key = Days.key(day)
            order.append(key)
            byDay[key] = DayValues(date: key)
        }

        let count = HKUnit.count()
        let bpm = HKUnit.count().unitDivided(by: .minute())
        let kcal = HKUnit.kilocalorie()
        let vo2 = HKUnit.literUnit(with: .milli)
            .unitDivided(by: HKUnit.gramUnit(with: .kilo).unitMultiplied(by: .minute()))

        for (key, value) in await daily(.stepCount, .cumulativeSum, count, from: first, to: now) {
            byDay[key]?.steps = value
        }
        for (key, value) in await daily(.distanceWalkingRunning, .cumulativeSum, .meter(), from: first, to: now) {
            byDay[key]?.distance = value
        }
        for (key, value) in await daily(.activeEnergyBurned, .cumulativeSum, kcal, from: first, to: now) {
            byDay[key]?.activeEnergy = value
        }
        for (key, value) in await daily(.basalEnergyBurned, .cumulativeSum, kcal, from: first, to: now) {
            byDay[key]?.restingEnergy = value
        }
        for (key, value) in await daily(.restingHeartRate, .discreteAverage, bpm, from: first, to: now) {
            byDay[key]?.restingHeartRate = value
        }
        for (key, value) in await daily(.heartRate, .discreteAverage, bpm, from: first, to: now) {
            byDay[key]?.heartRate = value
        }
        for (key, value) in await daily(.heartRateVariabilitySDNN, .discreteAverage, .secondUnit(with: .milli), from: first, to: now) {
            byDay[key]?.hrv = value
        }
        for (key, value) in await daily(.bodyMass, .mostRecent, .gramUnit(with: .kilo), from: first, to: now) {
            byDay[key]?.weight = value
        }
        for (key, value) in await daily(.bodyFatPercentage, .mostRecent, .percent(), from: first, to: now) {
            byDay[key]?.bodyFat = value * 100
        }
        for (key, value) in await daily(.vo2Max, .mostRecent, vo2, from: first, to: now) {
            byDay[key]?.vo2max = value
        }
        for (key, minutes) in await sleepMinutes(from: first, to: now) {
            byDay[key]?.sleep = minutes
        }

        let workouts = await samples(HKObjectType.workoutType(), from: first, to: now)
            .compactMap { $0 as? HKWorkout }
            .map { workout in
                PhoneWorkout(
                    id: workout.uuid.uuidString,
                    type: Self.name(of: workout.workoutActivityType),
                    start: workout.startDate,
                    end: workout.endDate,
                    distance: workout.totalDistance?.doubleValue(for: .meter()),
                    energy: workout.totalEnergyBurned?.doubleValue(for: .kilocalorie())
                )
            }
        return (order.compactMap { byDay[$0] }, workouts)
    }

    /// Today's food from LMS as one Apple Health entry, replaced on every sync: HealthKit keeps
    /// only the newest version of a sample with the same sync identifier.
    func writeEaten(kcal: Double, on date: Date) async throws {
        let type = Self.dietaryEnergy
        guard store.authorizationStatus(for: type) == .sharingAuthorized else { return }
        let id = "lms-eaten-\(Days.key(date))"
        if kcal < 1 {
            // Nothing eaten (any more): take back what an earlier sync wrote for the day.
            let mine = HKQuery.predicateForObjects(withMetadataKey: HKMetadataKeySyncIdentifier, allowedValues: [id])
            try await delete(type, mine)
            return
        }
        let calendar = Days.calendar
        let start = calendar.startOfDay(for: date)
        let endOfDay = calendar.date(byAdding: .day, value: 1, to: start)?.addingTimeInterval(-1) ?? date
        let end = min(Date(), endOfDay)
        guard end > start else { return }
        let sample = HKQuantitySample(
            type: type,
            quantity: HKQuantity(unit: .kilocalorie(), doubleValue: kcal.rounded()),
            start: start,
            end: end,
            metadata: [
                HKMetadataKeySyncIdentifier: id,
                HKMetadataKeySyncVersion: NSNumber(value: Int(Date().timeIntervalSince1970)),
            ]
        )
        try await save(sample)
    }

    // MARK: HealthKit, one query at a time

    /// A value per local day: the sum, the average or the day's last reading.
    private func daily(
        _ id: HKQuantityTypeIdentifier,
        _ option: HKStatisticsOptions,
        _ unit: HKUnit,
        from: Date,
        to: Date
    ) async -> [String: Double] {
        let type = HKQuantityType(id)
        let predicate = HKQuery.predicateForSamples(withStart: from, end: to, options: [])
        let store = self.store
        return await withCheckedContinuation { (continuation: CheckedContinuation<[String: Double], Never>) in
            let query = HKStatisticsCollectionQuery(
                quantityType: type,
                quantitySamplePredicate: predicate,
                options: option,
                anchorDate: from,
                intervalComponents: DateComponents(day: 1)
            )
            query.initialResultsHandler = { _, collection, _ in
                var out: [String: Double] = [:]
                collection?.enumerateStatistics(from: from, to: to) { statistics, _ in
                    let quantity: HKQuantity?
                    if option.contains(.cumulativeSum) {
                        quantity = statistics.sumQuantity()
                    } else if option.contains(.discreteAverage) {
                        quantity = statistics.averageQuantity()
                    } else {
                        quantity = statistics.mostRecentQuantity()
                    }
                    if let quantity, quantity.is(compatibleWith: unit) {
                        out[Days.key(statistics.startDate)] = quantity.doubleValue(for: unit)
                    }
                }
                continuation.resume(returning: out)
            }
            store.execute(query)
        }
    }

    private func samples(_ type: HKSampleType, from: Date, to: Date) async -> [HKSample] {
        let predicate = HKQuery.predicateForSamples(withStart: from, end: to, options: [])
        let store = self.store
        return await withCheckedContinuation { (continuation: CheckedContinuation<[HKSample], Never>) in
            let query = HKSampleQuery(
                sampleType: type,
                predicate: predicate,
                limit: HKObjectQueryNoLimit,
                sortDescriptors: [NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: true)]
            ) { _, results, _ in
                continuation.resume(returning: results ?? [])
            }
            store.execute(query)
        }
    }

    /// Minutes asleep per day: a night counts on the day it ends. The watch and the phone often
    /// both record the same night, so overlapping stretches are joined before they are added up.
    /// Without a watch there may be only "in bed" (the sleep schedule); that counts then.
    private func sleepMinutes(from: Date, to: Date) async -> [String: Double] {
        let all = await samples(HKCategoryType(.sleepAnalysis), from: from.addingTimeInterval(-86_400), to: to)
            .compactMap { $0 as? HKCategorySample }
        // asleepUnspecified 1, asleepCore 3, asleepDeep 4, asleepREM 5 (inBed 0, awake 2).
        let asleep = all.filter { [1, 3, 4, 5].contains($0.value) }.map { ($0.startDate, $0.endDate) }
        let inBed = all.filter { $0.value == 0 }.map { ($0.startDate, $0.endDate) }
        var out = Self.minutesByEndDay(Self.joined(asleep))
        for (day, minutes) in Self.minutesByEndDay(Self.joined(inBed)) where out[day] == nil {
            out[day] = minutes
        }
        return out
    }

    private static func joined(_ spans: [(Date, Date)]) -> [(Date, Date)] {
        var out: [(Date, Date)] = []
        for span in spans.sorted(by: { $0.0 < $1.0 }) {
            if let last = out.last, span.0 <= last.1 {
                out[out.count - 1].1 = max(last.1, span.1)
            } else {
                out.append(span)
            }
        }
        return out
    }

    private static func minutesByEndDay(_ spans: [(Date, Date)]) -> [String: Double] {
        var out: [String: Double] = [:]
        for (start, end) in spans {
            out[Days.key(end), default: 0] += end.timeIntervalSince(start) / 60
        }
        return out
    }

    private func save(_ sample: HKSample) async throws {
        let store = self.store
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            store.save(sample) { _, error in
                if let error { continuation.resume(throwing: error) } else { continuation.resume() }
            }
        }
    }

    private func delete(_ type: HKObjectType, _ predicate: NSPredicate) async throws {
        let store = self.store
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            store.deleteObjects(of: type, predicate: predicate) { _, _, error in
                if let error { continuation.resume(throwing: error) } else { continuation.resume() }
            }
        }
    }

    /// Apple's workout type as the name LMS matches its own exercises by (as on Android).
    static func name(of type: HKWorkoutActivityType) -> String {
        switch type {
        case .running: return "Running"
        case .walking: return "Walking"
        case .hiking: return "Hiking"
        case .cycling, .handCycling: return "Cycling"
        case .swimming: return "Swimming"
        case .rowing: return "Rowing"
        case .elliptical: return "Elliptical"
        case .stairClimbing, .stairs, .stepTraining: return "Stair climbing"
        case .jumpRope: return "Jump rope"
        case .yoga: return "Yoga"
        case .pilates: return "Pilates"
        case .cardioDance, .socialDance: return "Dancing"
        case .highIntensityIntervalTraining: return "HIIT"
        case .traditionalStrengthTraining, .functionalStrengthTraining, .coreTraining: return "Strength training"
        case .flexibility, .cooldown: return "Stretching"
        default: return "Workout"
        }
    }
}
