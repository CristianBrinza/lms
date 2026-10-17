import type { Translations } from '../../lib/i18n';
import type { EquipmentPreset, ExercisePreset } from './catalog';

/**
 * The catalog in Romanian and Russian. Keyed by the preset key (exercises) and kind (equipment),
 * never by name. The ways to do an exercise and the pieces of equipment share one list (WAYS), so
 * the bar's "Wide grip" and the pull-up's "Wide grip" read the same in every language.
 *
 * Words kept the same everywhere (the training glossary): serie / подход, repetare / повторение,
 * fandare / выпад, genuflexiune / приседание, flotare / отжимание, tracțiune / подтягивание,
 * planșă / планка, gantere / гантели, bandă elastică / резинка.
 */

interface Text {
  name: string;
  steps: string[];
}

export const EXERCISE_TEXT: Record<string, { ro: Text; ru: Text }> = {
  'push-up': {
    ro: {
      name: 'Flotări',
      steps: [
        'Mâinile sub umeri, corpul drept de la cap până la călcâie.',
        'Coboară până când pieptul aproape atinge podeaua, coatele la circa 45°.',
        'Împinge-te înapoi în sus fără să lași bazinul să cadă.',
      ],
    },
    ru: {
      name: 'Отжимания',
      steps: [
        'Руки под плечами, тело — одна линия от головы до пяток.',
        'Опустись, пока грудь почти не коснётся пола, локти примерно под 45°.',
        'Выжмись вверх, не проваливая таз.',
      ],
    },
  },
  'knee-push-up': {
    ro: {
      name: 'Flotări de pe genunchi',
      steps: [
        'Genunchii pe podea, mâinile sub umeri.',
        'Ține corpul drept de la cap la genunchi.',
        'Coboară pieptul, apoi împinge-te în sus.',
      ],
    },
    ru: {
      name: 'Отжимания с колен',
      steps: [
        'Колени на полу, руки под плечами.',
        'Держи прямую линию от головы до коленей.',
        'Опусти грудь, затем выжмись.',
      ],
    },
  },
  'incline-push-up': {
    ro: {
      name: 'Flotări înclinate',
      steps: [
        'Mâinile pe o masă, pe brațul canapelei sau pe pervaz.',
        'Du picioarele înapoi până când corpul e drept.',
        'Coboară pieptul spre margine, apoi împinge-te.',
      ],
    },
    ru: {
      name: 'Отжимания от опоры',
      steps: [
        'Руки на столе, подлокотнике дивана или подоконнике.',
        'Отступи ногами назад, пока тело не станет прямым.',
        'Опусти грудь к краю и оттолкнись.',
      ],
    },
  },
  'decline-push-up': {
    ro: {
      name: 'Flotări cu picioarele sus',
      steps: [
        'Picioarele pe un scaun sau o bancă, mâinile pe podea.',
        'Coboară încet, cu bazinul în linie.',
        'Împinge-te înapoi în sus.',
      ],
    },
    ru: {
      name: 'Отжимания с ногами на опоре',
      steps: [
        'Ноги на стуле или скамье, руки на полу.',
        'Опускайся медленно, таз на одной линии с телом.',
        'Выжмись обратно.',
      ],
    },
  },
  'diamond-push-up': {
    ro: {
      name: 'Flotări diamant',
      steps: [
        'Degetele mari și arătătoarele se ating sub piept.',
        'Coatele rămân lipite de corp când cobori.',
        'Împinge-te înapoi în sus.',
      ],
    },
    ru: {
      name: 'Алмазные отжимания',
      steps: [
        'Большие и указательные пальцы касаются друг друга под грудью.',
        'Опускаясь, держи локти прижатыми к телу.',
        'Выжмись обратно.',
      ],
    },
  },
  'pike-push-up': {
    ro: {
      name: 'Flotări în V întors',
      steps: [
        'Bazinul sus, corpul ca un V întors.',
        'Îndoaie coatele și du capul spre podea.',
        'Împinge-te înapoi în sus.',
      ],
    },
    ru: {
      name: 'Отжимания «домиком»',
      steps: [
        'Таз высоко, тело — перевёрнутая буква V.',
        'Согни локти и опусти голову к полу.',
        'Выжмись обратно.',
      ],
    },
  },
  'chair-dip': {
    ro: {
      name: 'Flotări pentru triceps la scaun',
      steps: [
        'Mâinile pe marginea din spatele tău, degetele înainte.',
        'Coboară până când coatele ajung la 90°.',
        'Împinge-te înapoi; ține umerii jos.',
      ],
    },
    ru: {
      name: 'Обратные отжимания от стула',
      steps: [
        'Руки на краю позади тебя, пальцы вперёд.',
        'Опустись, пока локти не согнутся до 90°.',
        'Выжмись обратно; плечи держи опущенными.',
      ],
    },
  },
  'pull-up': {
    ro: {
      name: 'Tracțiuni',
      steps: [
        'Atârnă cu mâinile puțin mai larg decât umerii, palmele înainte.',
        'Trage-te până când bărbia trece de bară.',
        'Coboară complet, controlat.',
      ],
    },
    ru: {
      name: 'Подтягивания',
      steps: [
        'Повисни, руки чуть шире плеч, ладони от себя.',
        'Подтянись, пока подбородок не окажется над перекладиной.',
        'Опустись полностью, подконтрольно.',
      ],
    },
  },
  'chin-up': {
    ro: {
      name: 'Tracțiuni cu priză inversă',
      steps: ['Palmele spre tine, la lățimea umerilor.', 'Trage pieptul spre bară.', 'Coboară încet.'],
    },
    ru: {
      name: 'Подтягивания обратным хватом',
      steps: ['Ладони к себе, на ширине плеч.', 'Тяни грудь к перекладине.', 'Опускайся медленно.'],
    },
  },
  'negative-pull-up': {
    ro: {
      name: 'Tracțiuni negative lente',
      steps: [
        'Sari sau urcă pe ceva, ca bărbia să fie deasupra barei.',
        'Coboară în 4–5 secunde.',
        'Pune picioarele jos și repetă.',
      ],
    },
    ru: {
      name: 'Медленные негативные подтягивания',
      steps: [
        'Запрыгни или встань на опору, чтобы подбородок был над перекладиной.',
        'Опускайся 4–5 секунд.',
        'Встань на пол и повтори.',
      ],
    },
  },
  'dead-hang': {
    ro: {
      name: 'Atârnare la bară',
      steps: [
        'Atârnă cu brațele drepte.',
        'Umerii ușor încordați, nu ridicați spre urechi.',
        'Respiră și menține.',
      ],
    },
    ru: {
      name: 'Вис на перекладине',
      steps: [
        'Повисни на прямых руках.',
        'Плечи слегка напряжены, не поднимай их к ушам.',
        'Дыши и держи.',
      ],
    },
  },
  'hanging-knee-raise': {
    ro: {
      name: 'Ridicări de genunchi la bară',
      steps: [
        'Atârnă de bară.',
        'Adu genunchii spre piept fără să te balansezi.',
        'Coboară încet.',
      ],
    },
    ru: {
      name: 'Подъёмы коленей в висе',
      steps: [
        'Повисни на перекладине.',
        'Подтяни колени к груди без раскачки.',
        'Опускай медленно.',
      ],
    },
  },
  'inverted-row': {
    ro: {
      name: 'Tracțiuni orizontale',
      steps: [
        'Lasă-te pe spate ținând mânerele, corpul drept.',
        'Trage pieptul spre mâini.',
        'Coboară controlat.',
      ],
    },
    ru: {
      name: 'Австралийские подтягивания',
      steps: [
        'Отклонись назад, держась за рукоятки, тело прямое.',
        'Подтяни грудь к рукам.',
        'Опускайся подконтрольно.',
      ],
    },
  },
  superman: {
    ro: {
      name: 'Superman',
      steps: [
        'Întins pe burtă, brațele înainte.',
        'Ridică puțin brațele, pieptul și picioarele de pe podea.',
        'Menține o secundă, apoi coboară.',
      ],
    },
    ru: {
      name: 'Супермен',
      steps: [
        'Ляг на живот, руки вперёд.',
        'Слегка оторви от пола руки, грудь и ноги.',
        'Задержись на секунду и опустись.',
      ],
    },
  },
  squat: {
    ro: {
      name: 'Genuflexiuni',
      steps: [
        'Tălpile la lățimea umerilor, vârfurile ușor în afară.',
        'Coboară cu bazinul înapoi până când coapsele sunt paralele cu podeaua.',
        'Ridică-te împingând în toată talpa.',
      ],
    },
    ru: {
      name: 'Приседания',
      steps: [
        'Стопы на ширине плеч, носки слегка врозь.',
        'Отведи таз назад и опустись, пока бёдра не станут параллельны полу.',
        'Встань, отталкиваясь всей стопой.',
      ],
    },
  },
  'jump-squat': {
    ro: {
      name: 'Genuflexiuni cu săritură',
      steps: [
        'Coboară în genuflexiune.',
        'Sari cât de sus poți.',
        'Aterizează ușor și treci direct în următoarea genuflexiune.',
      ],
    },
    ru: {
      name: 'Приседания с выпрыгиванием',
      steps: [
        'Присядь.',
        'Выпрыгни как можно выше.',
        'Приземлись мягко и сразу переходи в следующее приседание.',
      ],
    },
  },
  lunge: {
    ro: {
      name: 'Fandări',
      steps: [
        'Fă un pas înainte și coboară până când ambii genunchi sunt la 90°.',
        'Genunchiul din față deasupra gleznei.',
        'Împinge-te înapoi în picioare.',
      ],
    },
    ru: {
      name: 'Выпады',
      steps: [
        'Шагни вперёд и опустись, пока оба колена не согнутся до 90°.',
        'Переднее колено над лодыжкой.',
        'Оттолкнись и вернись в стойку.',
      ],
    },
  },
  'reverse-lunge': {
    ro: {
      name: 'Fandări înapoi',
      steps: [
        'Fă un pas înapoi și coboară genunchiul din spate spre podea.',
        'Ține pieptul sus.',
        'Adu piciorul înapoi.',
      ],
    },
    ru: {
      name: 'Обратные выпады',
      steps: [
        'Шагни назад и опусти заднее колено к полу.',
        'Грудь держи поднятой.',
        'Верни ногу на место.',
      ],
    },
  },
  'bulgarian-split-squat': {
    ro: {
      name: 'Fandări bulgărești',
      steps: [
        'Piciorul din spate pe un scaun, cel din față cu un pas mare înainte.',
        'Coboară drept în jos.',
        'Ridică-te împingând în călcâiul din față.',
      ],
    },
    ru: {
      name: 'Болгарские выпады',
      steps: [
        'Задняя нога на стуле, передняя — на большой шаг впереди.',
        'Опускайся строго вниз.',
        'Поднимись, толкаясь пяткой передней ноги.',
      ],
    },
  },
  'step-up': {
    ro: {
      name: 'Urcări pe treaptă',
      steps: [
        'Un picior pe treaptă.',
        'Urcă pe ea fără să te împingi cu piciorul din spate.',
        'Coboară încet.',
      ],
    },
    ru: {
      name: 'Зашагивания на платформу',
      steps: [
        'Одна нога на ступеньке.',
        'Встань на неё, не отталкиваясь задней ногой.',
        'Медленно спустись.',
      ],
    },
  },
  'wall-sit': {
    ro: {
      name: 'Scaunul la perete',
      steps: [
        'Cu spatele la perete, alunecă în jos până când genunchii sunt la 90°.',
        'Genunchii deasupra gleznelor.',
        'Menține.',
      ],
    },
    ru: {
      name: 'Стульчик у стены',
      steps: [
        'Спиной к стене, съезжай вниз, пока колени не согнутся до 90°.',
        'Колени над лодыжками.',
        'Держи.',
      ],
    },
  },
  'glute-bridge': {
    ro: {
      name: 'Podul pentru fesieri',
      steps: [
        'Pe spate, genunchii îndoiți, tălpile pe podea.',
        'Ridică bazinul până când corpul e drept de la umeri la genunchi.',
        'Strânge fesierii, apoi coboară.',
      ],
    },
    ru: {
      name: 'Ягодичный мостик',
      steps: [
        'Лёжа на спине, колени согнуты, стопы на полу.',
        'Подними таз, пока тело не выпрямится от плеч до коленей.',
        'Сожми ягодицы и опустись.',
      ],
    },
  },
  'single-leg-bridge': {
    ro: {
      name: 'Podul pe un picior',
      steps: [
        'Un picior pe podea, celălalt ridicat.',
        'Ridică bazinul.',
        'Coboară fără să atingi podeaua.',
      ],
    },
    ru: {
      name: 'Мостик на одной ноге',
      steps: ['Одна стопа на полу, другая нога поднята.', 'Подними таз.', 'Опускай, не касаясь пола.'],
    },
  },
  'hip-thrust': {
    ro: {
      name: 'Împingeri din bazin',
      steps: [
        'Partea de sus a spatelui pe marginea unei bănci sau a canapelei.',
        'Ridică bazinul până la orizontală.',
        'Coboară încet.',
      ],
    },
    ru: {
      name: 'Ягодичный мост от скамьи',
      steps: [
        'Верх спины на краю скамьи или дивана.',
        'Подними таз до горизонтали.',
        'Опускайся медленно.',
      ],
    },
  },
  'calf-raise': {
    ro: {
      name: 'Ridicări pe vârfuri',
      steps: [
        'Stai drept, cu o mână pe perete pentru echilibru.',
        'Ridică-te pe vârfuri.',
        'Coboară încet.',
      ],
    },
    ru: {
      name: 'Подъёмы на носки',
      steps: [
        'Встань прямо, рукой держись за стену для равновесия.',
        'Поднимись на носки.',
        'Опускайся медленно.',
      ],
    },
  },
  'goblet-squat': {
    ro: {
      name: 'Genuflexiuni cu greutatea la piept',
      steps: ['Ține greutatea la piept.', 'Coboară între genunchi, cu pieptul sus.', 'Ridică-te.'],
    },
    ru: {
      name: 'Кубковые приседания',
      steps: ['Держи вес у груди.', 'Приседай между коленями, грудь вверх.', 'Встань.'],
    },
  },
  'romanian-deadlift': {
    ro: {
      name: 'Îndreptări românești',
      steps: [
        'Greutățile în fața coapselor, genunchii ușor îndoiți.',
        'Împinge bazinul înapoi, greutățile aproape de picioare, spatele drept.',
        'Ridică-te strângând fesierii.',
      ],
    },
    ru: {
      name: 'Румынская тяга',
      steps: [
        'Вес перед бёдрами, колени слегка согнуты.',
        'Отведи таз назад, вес близко к ногам, спина прямая.',
        'Выпрямись, сжимая ягодицы.',
      ],
    },
  },
  'kettlebell-swing': {
    ro: {
      name: 'Balansări cu kettlebell',
      steps: [
        'Îndoaie-te din șold și trimite kettlebell-ul înapoi printre picioare.',
        'Împinge bazinul înainte ca să-l ridici până la piept.',
        'Lasă-l să cadă înapoi în aplecare.',
      ],
    },
    ru: {
      name: 'Махи гирей',
      steps: [
        'Наклонись от таза и заведи гирю назад между ног.',
        'Резко подай таз вперёд, чтобы гиря поднялась до груди.',
        'Дай ей опуститься обратно в наклон.',
      ],
    },
  },
  thruster: {
    ro: {
      name: 'Genuflexiuni cu împins, cu gantere',
      steps: [
        'Greutățile la umeri, coboară în genuflexiune.',
        'Ridică-te și împinge-le deasupra capului dintr-o mișcare.',
        'Adu-le înapoi la umeri.',
      ],
    },
    ru: {
      name: 'Трастеры с гантелями',
      steps: [
        'Вес у плеч, присядь.',
        'Встань и выжми его над головой одним движением.',
        'Верни вес к плечам.',
      ],
    },
  },
  'biceps-curl': {
    ro: {
      name: 'Flexii pentru biceps',
      steps: [
        'Coatele lângă corp.',
        'Ridică greutățile fără să te balansezi.',
        'Coboară încet.',
      ],
    },
    ru: {
      name: 'Сгибания на бицепс',
      steps: ['Локти прижаты к бокам.', 'Подними вес без раскачки.', 'Опускай медленно.'],
    },
  },
  'hammer-curl': {
    ro: {
      name: 'Flexii ciocan',
      steps: ['Palmele față în față.', 'Ridică, cu coatele nemișcate.', 'Coboară încet.'],
    },
    ru: {
      name: 'Молотковые сгибания',
      steps: ['Ладони смотрят друг на друга.', 'Поднимай, локти неподвижны.', 'Опускай медленно.'],
    },
  },
  'shoulder-press': {
    ro: {
      name: 'Împins pentru umeri',
      steps: [
        'Greutățile la înălțimea umerilor.',
        'Împinge drept în sus fără să arcuiești spatele.',
        'Coboară la umeri.',
      ],
    },
    ru: {
      name: 'Жим над головой',
      steps: [
        'Вес на уровне плеч.',
        'Выжми строго вверх, не прогибая спину.',
        'Опусти к плечам.',
      ],
    },
  },
  'lateral-raise': {
    ro: {
      name: 'Ridicări laterale',
      steps: [
        'Brațele pe lângă corp, coatele ușor îndoite.',
        'Ridică-le lateral până la înălțimea umerilor.',
        'Coboară încet.',
      ],
    },
    ru: {
      name: 'Разведения в стороны',
      steps: [
        'Руки вдоль тела, локти слегка согнуты.',
        'Подними их через стороны до уровня плеч.',
        'Опускай медленно.',
      ],
    },
  },
  'dumbbell-row': {
    ro: {
      name: 'Ramat cu un braț',
      steps: [
        'O mână și un genunchi pe o bancă sau un scaun.',
        'Trage greutatea spre șold.',
        'Coboară cu spatele drept.',
      ],
    },
    ru: {
      name: 'Тяга одной рукой',
      steps: [
        'Одна рука и колено на скамье или стуле.',
        'Тяни вес к бедру.',
        'Опускай, держа спину прямой.',
      ],
    },
  },
  'bent-over-row': {
    ro: {
      name: 'Ramat din aplecare',
      steps: [
        'Apleacă-te din șold, cu spatele drept.',
        'Trage ambele greutăți spre coastele de jos.',
        'Coboară încet.',
      ],
    },
    ru: {
      name: 'Тяга в наклоне',
      steps: [
        'Наклонись от таза, спина прямая.',
        'Тяни оба веса к нижним рёбрам.',
        'Опускай медленно.',
      ],
    },
  },
  'floor-press': {
    ro: {
      name: 'Împins de la podea',
      steps: [
        'Întins pe podea, brațele de la umăr la cot sprijinite pe podea.',
        'Împinge greutățile în sus.',
        'Coboară până când coatele ating podeaua.',
      ],
    },
    ru: {
      name: 'Жим лёжа на полу',
      steps: [
        'Ляг на пол, руки от плеча до локтя лежат на полу.',
        'Выжми вес вверх.',
        'Опускай, пока локти не коснутся пола.',
      ],
    },
  },
  'bench-press': {
    ro: {
      name: 'Împins cu gantere pe bancă',
      steps: [
        'Întins pe bancă, greutățile deasupra pieptului.',
        'Coboară-le lângă piept.',
        'Împinge în sus.',
      ],
    },
    ru: {
      name: 'Жим гантелей лёжа',
      steps: ['Ляг на скамью, вес над грудью.', 'Опусти его по бокам груди.', 'Выжми вверх.'],
    },
  },
  'chest-fly': {
    ro: {
      name: 'Fluturări pentru piept',
      steps: [
        'Pe podea sau pe bancă, greutățile deasupra pieptului.',
        'Deschide larg brațele, cu coatele ușor îndoite.',
        'Adu-le înapoi ca într-o îmbrățișare.',
      ],
    },
    ru: {
      name: 'Разводка на грудь',
      steps: [
        'На полу или скамье, вес над грудью.',
        'Широко разведи руки, локти чуть согнуты.',
        'Сведи их обратно, как в объятии.',
      ],
    },
  },
  'triceps-extension': {
    ro: {
      name: 'Extensii pentru triceps deasupra capului',
      steps: [
        'Ține o greutate deasupra capului cu ambele mâini.',
        'Coboar-o după cap, cu coatele înainte.',
        'Întinde brațele.',
      ],
    },
    ru: {
      name: 'Разгибания на трицепс из-за головы',
      steps: [
        'Держи один вес над головой двумя руками.',
        'Опусти его за голову, локти смотрят вперёд.',
        'Выпрями руки.',
      ],
    },
  },
  shrug: {
    ro: {
      name: 'Ridicări de umeri',
      steps: ['Greutățile pe lângă corp.', 'Ridică umerii spre urechi.', 'Coboară încet.'],
    },
    ru: {
      name: 'Шраги',
      steps: ['Вес вдоль тела.', 'Подними плечи к ушам.', 'Опускай медленно.'],
    },
  },
  'band-pull-apart': {
    ro: {
      name: 'Depărtări cu banda elastică',
      steps: [
        'Ține banda în față, la înălțimea umerilor.',
        'Întinde-o până atinge pieptul.',
        'Revino încet.',
      ],
    },
    ru: {
      name: 'Разведение резинки',
      steps: [
        'Держи резинку перед собой на уровне плеч.',
        'Растягивай, пока она не коснётся груди.',
        'Медленно вернись.',
      ],
    },
  },
  'band-row': {
    ro: {
      name: 'Ramat cu banda elastică',
      steps: [
        'Banda în jurul tălpilor sau al unei clanțe.',
        'Trage mâinile spre coaste.',
        'Revino încet.',
      ],
    },
    ru: {
      name: 'Тяга резинки',
      steps: [
        'Резинка вокруг стоп или дверной ручки.',
        'Тяни руки к рёбрам.',
        'Медленно вернись.',
      ],
    },
  },
  'farmer-carry': {
    ro: {
      name: 'Mersul fermierului',
      steps: [
        'Greutăți mari pe lângă corp.',
        'Mergi drept, cu pași mici.',
        'Pune-le jos controlat.',
      ],
    },
    ru: {
      name: 'Прогулка фермера',
      steps: [
        'Тяжёлый вес в руках вдоль тела.',
        'Иди прямо мелкими шагами.',
        'Опусти вес подконтрольно.',
      ],
    },
  },
  'turkish-get-up': {
    ro: {
      name: 'Ridicarea turcească',
      steps: [
        'Întins pe spate, cu greutatea împinsă în sus.',
        'Ridică-te pe cot, pe palmă, în genunchi, apoi în picioare — cu ochii pe greutate.',
        'Refă fiecare pas în ordine inversă până jos.',
      ],
    },
    ru: {
      name: 'Турецкий подъём',
      steps: [
        'Ляг на спину, вес в выпрямленной руке над собой.',
        'Поднимись на локоть, на ладонь, на колено, затем встань — глаза на весе.',
        'Пройди все шаги в обратном порядке вниз.',
      ],
    },
  },
  'hand-grip': {
    ro: {
      name: 'Strângeri de extensor',
      steps: ['Strânge extensorul până la capăt.', 'Menține o clipă.', 'Deschide încet.'],
    },
    ru: {
      name: 'Сжимания эспандера',
      steps: ['Сожми эспандер до конца.', 'Задержись на мгновение.', 'Медленно разожми.'],
    },
  },
  plank: {
    ro: {
      name: 'Planșă',
      steps: ['Antebrațele sub umeri.', 'Corpul drept, fesierii strânși.', 'Respiră și menține.'],
    },
    ru: {
      name: 'Планка',
      steps: ['Предплечья под плечами.', 'Тело в одну линию, ягодицы напряжены.', 'Дыши и держи.'],
    },
  },
  'side-plank': {
    ro: {
      name: 'Planșă laterală',
      steps: [
        'Antebrațul sub umăr, picioarele unul peste altul.',
        'Ridică bazinul în linie dreaptă.',
        'Menține, apoi schimbă partea.',
      ],
    },
    ru: {
      name: 'Боковая планка',
      steps: [
        'Предплечье под плечом, ноги одна на другой.',
        'Подними таз в прямую линию.',
        'Держи, затем смени сторону.',
      ],
    },
  },
  crunch: {
    ro: {
      name: 'Abdomene',
      steps: ['Pe spate, genunchii îndoiți.', 'Ridică umerii de pe podea.', 'Coboară încet.'],
    },
    ru: {
      name: 'Скручивания',
      steps: ['Лёжа на спине, колени согнуты.', 'Оторви плечи от пола.', 'Опускайся медленно.'],
    },
  },
  'bicycle-crunch': {
    ro: {
      name: 'Abdomene bicicletă',
      steps: [
        'Mâinile la cap, picioarele sus.',
        'Cotul spre genunchiul opus, celălalt picior întins.',
        'Schimbă părțile lin.',
      ],
    },
    ru: {
      name: 'Велосипед',
      steps: [
        'Руки у головы, ноги подняты.',
        'Локоть к противоположному колену, другая нога вытянута.',
        'Плавно меняй стороны.',
      ],
    },
  },
  'leg-raise': {
    ro: {
      name: 'Ridicări de picioare',
      steps: [
        'Pe spate, mâinile sub bazin.',
        'Ridică picioarele drepte la verticală.',
        'Coboară fără să atingi podeaua.',
      ],
    },
    ru: {
      name: 'Подъёмы ног лёжа',
      steps: [
        'Лёжа на спине, руки под тазом.',
        'Подними прямые ноги вертикально.',
        'Опускай, не касаясь пола.',
      ],
    },
  },
  'russian-twist': {
    ro: {
      name: 'Răsuciri rusești',
      steps: [
        'Așezat, ușor lăsat pe spate, picioarele sus sau jos.',
        'Rotește umerii dintr-o parte în alta.',
        'Numără fiecare parte.',
      ],
    },
    ru: {
      name: 'Русские скручивания',
      steps: [
        'Сядь с наклоном назад, ноги на весу или на полу.',
        'Поворачивай плечи из стороны в сторону.',
        'Считай каждую сторону.',
      ],
    },
  },
  'dead-bug': {
    ro: {
      name: 'Gândacul mort',
      steps: [
        'Pe spate, brațele în sus, genunchii deasupra șoldurilor.',
        'Coboară brațul și piciorul opus, cu spatele lipit de podea.',
        'Revino și schimbă.',
      ],
    },
    ru: {
      name: 'Мёртвый жук',
      steps: [
        'Лёжа на спине, руки вверх, колени над тазом.',
        'Опусти противоположные руку и ногу, поясница прижата.',
        'Вернись и смени сторону.',
      ],
    },
  },
  'bird-dog': {
    ro: {
      name: 'Câine-pasăre',
      steps: [
        'În patru labe.',
        'Întinde un braț înainte și piciorul opus înapoi.',
        'Menține o secundă, schimbă.',
      ],
    },
    ru: {
      name: 'Птица-собака',
      steps: [
        'Встань на четвереньки.',
        'Вытяни одну руку вперёд, а противоположную ногу назад.',
        'Задержись на секунду, смени сторону.',
      ],
    },
  },
  'hollow-hold': {
    ro: {
      name: 'Menținere în poziție concavă',
      steps: [
        'Pe spate, cu zona lombară lipită de podea.',
        'Ridică umerii și picioarele drepte.',
        'Menține forma de banană.',
      ],
    },
    ru: {
      name: 'Лодочка на спине',
      steps: [
        'Лёжа на спине, поясница прижата к полу.',
        'Подними плечи и прямые ноги.',
        'Держи форму банана.',
      ],
    },
  },
  'mountain-climber': {
    ro: {
      name: 'Alpinistul',
      steps: [
        'Planșă pe brațele întinse.',
        'Adu genunchii spre piept, pe rând.',
        'Ține bazinul jos.',
      ],
    },
    ru: {
      name: 'Скалолаз',
      steps: [
        'Упор лёжа на прямых руках.',
        'Поочерёдно подтягивай колени к груди.',
        'Держи таз низко.',
      ],
    },
  },
  'ab-wheel': {
    ro: {
      name: 'Rulări cu roata pentru abdomene',
      steps: [
        'În genunchi, ținând roata.',
        'Rulează înainte cât poți ține spatele drept.',
        'Revino trăgând din abdomen.',
      ],
    },
    ru: {
      name: 'Раскатка ролика для пресса',
      steps: [
        'Встань на колени, держа ролик.',
        'Катись вперёд, пока можешь держать спину прямой.',
        'Вернись усилием пресса.',
      ],
    },
  },
  'bear-crawl': {
    ro: {
      name: 'Mersul ursului',
      steps: [
        'Pe palme și tălpi, genunchii puțin deasupra podelei.',
        'Mergi înainte și înapoi cu pași mici.',
        'Spatele drept, bazinul jos.',
      ],
    },
    ru: {
      name: 'Медвежья походка',
      steps: [
        'Упор на руки и стопы, колени чуть над полом.',
        'Ползи вперёд и назад мелкими шагами.',
        'Спина прямая, таз низко.',
      ],
    },
  },
  'jumping-jacks': {
    ro: {
      name: 'Sărituri cu depărtare',
      steps: [
        'Sari depărtând picioarele în timp ce ridici brațele.',
        'Sari înapoi cu picioarele împreună.',
        'Păstrează un ritm constant.',
      ],
    },
    ru: {
      name: 'Прыжки «звёздочка»',
      steps: [
        'Прыжком расставь ноги, поднимая руки вверх.',
        'Прыжком сведи ноги обратно.',
        'Держи ровный ритм.',
      ],
    },
  },
  'high-knees': {
    ro: {
      name: 'Genunchii sus',
      steps: ['Aleargă pe loc.', 'Genunchii până la înălțimea șoldurilor.', 'Lucrează din brațe.'],
    },
    ru: {
      name: 'Бег с высоким подниманием бедра',
      steps: ['Беги на месте.', 'Колени до уровня таза.', 'Активно работай руками.'],
    },
  },
  burpee: {
    ro: {
      name: 'Burpee',
      steps: [
        'Coboară în genuflexiune, mâinile jos, sari cu picioarele înapoi.',
        'O flotare (dacă vrei), apoi sari cu picioarele înapoi la mâini.',
        'Sari în sus cu brațele deasupra capului.',
      ],
    },
    ru: {
      name: 'Бёрпи',
      steps: [
        'Присядь, руки на пол, прыжком отведи ноги назад.',
        'Отжимание (по желанию), прыжком верни ноги к рукам.',
        'Выпрыгни вверх, руки над головой.',
      ],
    },
  },
  'skater-jump': {
    ro: {
      name: 'Sărituri de patinator',
      steps: [
        'Sari lateral pe un picior.',
        'Du celălalt picior în spate.',
        'Sari înapoi în partea cealaltă.',
      ],
    },
    ru: {
      name: 'Прыжки конькобежца',
      steps: [
        'Прыгни в сторону на одну ногу.',
        'Другую ногу заведи назад.',
        'Прыгни обратно в другую сторону.',
      ],
    },
  },
  'march-in-place': {
    ro: {
      name: 'Mers pe loc',
      steps: [
        'Mergi pe loc, cu genunchii sus.',
        'Balansează brațele.',
        'Silențios și blând cu articulațiile.',
      ],
    },
    ru: {
      name: 'Ходьба на месте',
      steps: ['Шагай на месте, поднимая колени.', 'Работай руками.', 'Тихо и бережно для суставов.'],
    },
  },
  'shadow-boxing': {
    ro: {
      name: 'Box cu umbra',
      steps: [
        'Garda sus, ușor pe picioare.',
        'Lovește cu directe, crosuri și croșee.',
        'Rotește bazinul la fiecare lovitură.',
      ],
    },
    ru: {
      name: 'Бой с тенью',
      steps: [
        'Руки в защите, лёгкость в ногах.',
        'Бей джебы, кроссы и хуки.',
        'Поворачивай таз с каждым ударом.',
      ],
    },
  },
  'jump-rope': {
    ro: {
      name: 'Sărituri cu coarda',
      steps: [
        'Rotește coarda din încheieturi.',
        'Sărituri mici pe pernițele tălpilor.',
        'Coatele aproape de corp.',
      ],
    },
    ru: {
      name: 'Прыжки на скакалке',
      steps: ['Вращай скакалку кистями.', 'Мелкие прыжки на подушечках стоп.', 'Локти близко к телу.'],
    },
  },
  run: {
    ro: {
      name: 'Alergare',
      steps: [
        'Începe ușor în primele minute.',
        'Un ritm la care încă poți vorbi.',
        'Ultimele minute mergi pe jos, ca să te liniștești.',
      ],
    },
    ru: {
      name: 'Бег',
      steps: [
        'Первые минуты беги легко.',
        'Темп, в котором ещё можно разговаривать.',
        'Последние минуты пройди шагом, чтобы остыть.',
      ],
    },
  },
  'intervals-run': {
    ro: {
      name: 'Alergare pe intervale',
      steps: [
        'Aleargă repede pe durata intervalului.',
        'În pauză mergi pe jos sau aleargă încet.',
        'Repetă la fiecare serie.',
      ],
    },
    ru: {
      name: 'Интервальный бег',
      steps: [
        'Беги быстро весь интервал.',
        'В отдыхе иди шагом или беги трусцой.',
        'Повторяй в каждом подходе.',
      ],
    },
  },
  walk: {
    ro: {
      name: 'Mers pe jos',
      steps: [
        'Un ritm alert.',
        'Brațele se balansează.',
        'Contează și când oricum mergi undeva.',
      ],
    },
    ru: {
      name: 'Ходьба',
      steps: ['Бодрый темп.', 'Руки двигаются в такт.', 'Засчитывай и когда всё равно куда-то идёшь.'],
    },
  },
  'incline-walk': {
    ro: {
      name: 'Mers în pantă',
      steps: [
        'Setează o înclinare la care poți merge fără să te ții.',
        'Ritm constant.',
        'Scade înclinarea în ultimele minute.',
      ],
    },
    ru: {
      name: 'Ходьба в гору',
      steps: [
        'Поставь наклон, при котором можно идти, не держась за поручни.',
        'Ровный темп.',
        'Последние минуты уменьши наклон.',
      ],
    },
  },
  cycling: {
    ro: {
      name: 'Bicicletă',
      steps: [
        'Șaua la înălțimea șoldului.',
        'Pedalează într-un ritm constant.',
        'Mărește rezistența pe porțiunile grele.',
      ],
    },
    ru: {
      name: 'Велосипед',
      steps: [
        'Седло на уровне таза.',
        'Крути педали в ровном темпе.',
        'На тяжёлых отрезках добавляй сопротивление.',
      ],
    },
  },
  rowing: {
    ro: {
      name: 'Vâslit',
      steps: [
        'Picioarele, apoi spatele, apoi brațele.',
        'La revenire: brațele, spatele, apoi picioarele.',
        'Trageri lungi și line.',
      ],
    },
    ru: {
      name: 'Гребля',
      steps: [
        'Ноги, затем спина, затем руки.',
        'Обратно: руки, спина, затем ноги.',
        'Длинные плавные гребки.',
      ],
    },
  },
  'stair-climb': {
    ro: {
      name: 'Urcat pe scări',
      steps: [
        'Urcă într-un ritm constant.',
        'Toată talpa pe fiecare treaptă.',
        'Coboară fără grabă.',
      ],
    },
    ru: {
      name: 'Подъём по лестнице',
      steps: [
        'Поднимайся в ровном темпе.',
        'Ставь всю стопу на каждую ступеньку.',
        'Спускайся спокойно.',
      ],
    },
  },
  'arm-circles': {
    ro: {
      name: 'Rotiri de brațe',
      steps: [
        'Brațele întinse lateral.',
        'Cercuri mici, din ce în ce mai mari.',
        'La jumătate schimbă sensul.',
      ],
    },
    ru: {
      name: 'Вращения руками',
      steps: [
        'Руки в стороны.',
        'Маленькие круги, постепенно всё больше.',
        'На середине смени направление.',
      ],
    },
  },
  'hip-circles': {
    ro: {
      name: 'Rotiri de bazin',
      steps: ['Mâinile pe șolduri.', 'Cercuri mari și lente.', 'La jumătate schimbă sensul.'],
    },
    ru: {
      name: 'Вращения тазом',
      steps: ['Руки на поясе.', 'Большие медленные круги.', 'На середине смени направление.'],
    },
  },
  'cat-cow': {
    ro: {
      name: 'Pisica–vaca',
      steps: [
        'În patru labe.',
        'Rotunjește spatele în sus, apoi lasă-l să coboare și privește în sus.',
        'Mișcă-te odată cu respirația.',
      ],
    },
    ru: {
      name: 'Кошка–корова',
      steps: [
        'Встань на четвереньки.',
        'Округли спину вверх, затем прогнись и посмотри вверх.',
        'Двигайся в ритме дыхания.',
      ],
    },
  },
  inchworm: {
    ro: {
      name: 'Omida',
      steps: [
        'Din picioare, mâinile la podea.',
        'Mergi cu ele înainte până în planșă.',
        'Revino și ridică-te.',
      ],
    },
    ru: {
      name: 'Гусеница',
      steps: [
        'Из положения стоя поставь руки на пол.',
        'Пройди руками вперёд до планки.',
        'Вернись и встань.',
      ],
    },
  },
  'worlds-greatest-stretch': {
    ro: {
      name: 'Cea mai bună întindere',
      steps: [
        'Fandare înainte, mâna în interiorul tălpii din față.',
        'Rotește celălalt braț în sus, spre tavan.',
        'Revino jos, apoi schimbă.',
      ],
    },
    ru: {
      name: 'Лучшая растяжка в мире',
      steps: [
        'Выпад вперёд, рука с внутренней стороны передней стопы.',
        'Разверни другую руку вверх, к потолку.',
        'Опусти руку и смени сторону.',
      ],
    },
  },
  'downward-dog': {
    ro: {
      name: 'Câinele cu fața în jos',
      steps: [
        'Palmele și tălpile pe podea, bazinul sus.',
        'Călcâiele spre podea.',
        'Spatele lung, respiră.',
      ],
    },
    ru: {
      name: 'Собака мордой вниз',
      steps: ['Руки и стопы на полу, таз высоко.', 'Пятки тянутся к полу.', 'Спина длинная, дыши.'],
    },
  },
  cobra: {
    ro: {
      name: 'Poziția cobrei',
      steps: ['Întins pe burtă, mâinile sub umeri.', 'Ridică ușor pieptul.', 'Bazinul rămâne jos.'],
    },
    ru: {
      name: 'Поза кобры',
      steps: ['Ляг на живот, руки под плечами.', 'Мягко подними грудь.', 'Таз остаётся на полу.'],
    },
  },
  'childs-pose': {
    ro: {
      name: 'Poziția copilului',
      steps: [
        'În genunchi, așază-te pe călcâie.',
        'Brațele întinse în față, fruntea jos.',
        'Respiră în spate.',
      ],
    },
    ru: {
      name: 'Поза ребёнка',
      steps: ['Встань на колени, сядь на пятки.', 'Руки вытянуты вперёд, лоб на полу.', 'Дыши в спину.'],
    },
  },
  'hamstring-stretch': {
    ro: {
      name: 'Întinderea ischiogambierilor',
      steps: [
        'Un picior drept, călcâiul pe podea.',
        'Apleacă-te înainte cu spatele drept.',
        'Menține, apoi schimbă.',
      ],
    },
    ru: {
      name: 'Растяжка задней поверхности бедра',
      steps: [
        'Одна нога прямая, пятка на полу.',
        'Наклонись вперёд с прямой спиной.',
        'Держи, затем смени ногу.',
      ],
    },
  },
  'hip-flexor-stretch': {
    ro: {
      name: 'Întinderea flexorilor șoldului',
      steps: [
        'Sprijinit pe un genunchi.',
        'Bagă bazinul sub tine și deplasează-te înainte.',
        'Menține, apoi schimbă.',
      ],
    },
    ru: {
      name: 'Растяжка сгибателей бедра',
      steps: ['Встань на одно колено.', 'Подкрути таз и сместись вперёд.', 'Держи, затем смени ногу.'],
    },
  },
  'quad-stretch': {
    ro: {
      name: 'Întinderea cvadricepsului',
      steps: [
        'În picioare, ține o talpă la spate.',
        'Genunchii împreună, bazinul înainte.',
        'Menține, apoi schimbă.',
      ],
    },
    ru: {
      name: 'Растяжка квадрицепса',
      steps: ['Стоя, держи одну стопу сзади.', 'Колени вместе, таз вперёд.', 'Держи, затем смени ногу.'],
    },
  },
  'chest-stretch': {
    ro: {
      name: 'Întinderea pieptului în cadrul ușii',
      steps: ['Antebrațul pe tocul ușii.', 'Fă ușor un pas înainte.', 'Menține.'],
    },
    ru: {
      name: 'Растяжка груди в дверном проёме',
      steps: ['Предплечье на дверном косяке.', 'Мягко шагни вперёд.', 'Держи.'],
    },
  },
  'foam-rolling': {
    ro: {
      name: 'Masaj cu rola',
      steps: [
        'Rulează încet peste câte un mușchi.',
        'Oprește-te pe zonele încordate.',
        'Respiră; nu rula zona lombară.',
      ],
    },
    ru: {
      name: 'Прокатка на ролике',
      steps: [
        'Медленно прокатывай по одной мышце.',
        'Задерживайся на зажатых местах.',
        'Дыши; поясницу не прокатывай.',
      ],
    },
  },
};

/** The ways to do an exercise and the pieces of equipment, by their English name. */
export const WAYS: Record<string, { ro: string; ru: string }> = {
  // Hands, grips, stances
  'Wide hands': { ro: 'Mâinile larg', ru: 'Широкая постановка рук' },
  'Shoulder-width': { ro: 'La lățimea umerilor', ru: 'На ширине плеч' },
  'Close hands': { ro: 'Mâinile apropiate', ru: 'Узкая постановка рук' },
  'On fists': { ro: 'Pe pumni', ru: 'На кулаках' },
  'Slow down, 3 s': { ro: 'Coborâre lentă, 3 s', ru: 'Медленно вниз, 3 с' },
  'Knees bent': { ro: 'Genunchii îndoiți', ru: 'Колени согнуты' },
  'Legs straight': { ro: 'Picioarele drepte', ru: 'Прямые ноги' },
  'Feet raised': { ro: 'Picioarele ridicate', ru: 'Ноги на возвышении' },
  'Wide grip': { ro: 'Priză largă', ru: 'Широкий хват' },
  'Close grip': { ro: 'Priză îngustă', ru: 'Узкий хват' },
  'Neutral grip (parallel)': { ro: 'Priză neutră (paralelă)', ru: 'Нейтральный хват (параллельный)' },
  'Mixed grip': { ro: 'Priză mixtă', ru: 'Разнохват' },
  'Arms straight hang': { ro: 'Atârnare cu brațele drepte', ru: 'Вис на прямых руках' },
  'Two hands': { ro: 'Cu două mâini', ru: 'Двумя руками' },
  'One hand': { ro: 'Cu o mână', ru: 'Одной рукой' },
  'Knees to the side': { ro: 'Genunchii în lateral', ru: 'Колени в сторону' },
  'Wide stance': { ro: 'Picioarele larg', ru: 'Широкая постановка ног' },
  'Narrow stance': { ro: 'Picioarele apropiate', ru: 'Узкая постановка ног' },
  'Pause at the bottom': { ro: 'Pauză jos', ru: 'Пауза внизу' },
  'Tempo 3-1-1': { ro: 'Tempo 3-1-1', ru: 'Темп 3-1-1' },
  Forward: { ro: 'Înainte', ru: 'Вперёд' },
  Walking: { ro: 'Din mers', ru: 'В движении' },
  'Side lunge': { ro: 'Fandare laterală', ru: 'Боковой выпад' },
  'Feet close': { ro: 'Tălpile apropiate', ru: 'Стопы близко' },
  'Feet wide': { ro: 'Tălpile depărtate', ru: 'Стопы широко' },
  'Pause at the top': { ro: 'Pauză sus', ru: 'Пауза вверху' },
  'Both legs': { ro: 'Pe ambele picioare', ru: 'На двух ногах' },
  'Single leg': { ro: 'Pe un picior', ru: 'На одной ноге' },
  'On a step': { ro: 'Pe o treaptă', ru: 'На ступеньке' },
  'Alternating hands': { ro: 'Alternând mâinile', ru: 'Со сменой рук' },
  'Both arms': { ro: 'Cu ambele brațe', ru: 'Обеими руками' },
  Alternating: { ro: 'Alternativ', ru: 'Поочерёдно' },
  Standing: { ro: 'În picioare', ru: 'Стоя' },
  Seated: { ro: 'Șezând', ru: 'Сидя' },
  'One arm at a time': { ro: 'Câte un braț', ru: 'По одной руке' },
  'Neutral grip (palms in)': {
    ro: 'Priză neutră (palmele față în față)',
    ru: 'Нейтральный хват (ладони внутрь)',
  },
  'Palm in': { ro: 'Palma spre corp', ru: 'Ладонь к корпусу' },
  'Palm back': { ro: 'Palma spre spate', ru: 'Ладонь назад' },
  'Elbow wide': { ro: 'Cotul în lateral', ru: 'Локоть в сторону' },
  'Palms down': { ro: 'Palmele în jos', ru: 'Ладони вниз' },
  'Palms in': { ro: 'Palmele față în față', ru: 'Ладони друг к другу' },
  Underhand: { ro: 'Priză inversă', ru: 'Обратный хват' },
  'Palms up': { ro: 'Palmele în sus', ru: 'Ладони вверх' },
  Overhead: { ro: 'Deasupra capului', ru: 'Над головой' },
  'Both hands': { ro: 'În ambele mâini', ru: 'В обеих руках' },
  'One hand (suitcase)': { ro: 'Într-o mână (ca o valiză)', ru: 'В одной руке (как чемодан)' },
  'On forearms': { ro: 'Pe antebrațe', ru: 'На предплечьях' },
  'Arms straight': { ro: 'Pe brațele întinse', ru: 'На прямых руках' },
  'Shoulder taps': { ro: 'Atingeri de umăr', ru: 'Касания плеч' },
  'On forearm': { ro: 'Pe antebraț', ru: 'На предплечье' },
  'Arm straight': { ro: 'Pe brațul întins', ru: 'На прямой руке' },
  'With leg lift': { ro: 'Cu ridicarea piciorului', ru: 'С подъёмом ноги' },
  'Hands by the head': { ro: 'Mâinile la cap', ru: 'Руки у головы' },
  'Arms crossed': { ro: 'Brațele încrucișate', ru: 'Руки скрещены на груди' },
  'Arms straight up': { ro: 'Brațele drepte în sus', ru: 'Прямые руки вверх' },
  Easy: { ro: 'Ușor', ru: 'Лёгкий' },
  Tempo: { ro: 'Tempo', ru: 'Темповый' },
  Long: { ro: 'Lung', ru: 'Длительный' },
  // Pieces of equipment
  'Yellow, light': { ro: 'Galbenă, ușoară', ru: 'Жёлтая, лёгкая' },
  'Red, medium': { ro: 'Roșie, medie', ru: 'Красная, средняя' },
  'Green, heavy': { ro: 'Verde, grea', ru: 'Зелёная, тяжёлая' },
  'Blue, extra heavy': { ro: 'Albastră, foarte grea', ru: 'Синяя, очень тяжёлая' },
  'Black, very heavy': { ro: 'Neagră, extrem de grea', ru: 'Чёрная, сверхтяжёлая' },
  'Rings high': { ro: 'Inelele sus', ru: 'Кольца высоко' },
  'Rings low': { ro: 'Inelele jos', ru: 'Кольца низко' },
};

interface EquipmentText {
  name: string;
  note?: string;
}

export const EQUIPMENT_TEXT: Record<string, { ro: EquipmentText; ru: EquipmentText }> = {
  mat: { ro: { name: 'Saltea de fitness' }, ru: { name: 'Коврик для фитнеса' } },
  dumbbells: { ro: { name: 'Gantere' }, ru: { name: 'Гантели' } },
  kettlebell: { ro: { name: 'Kettlebell' }, ru: { name: 'Гиря' } },
  barbell: { ro: { name: 'Bară cu discuri' }, ru: { name: 'Штанга с блинами' } },
  bands: {
    ro: { name: 'Benzi elastice', note: 'Ușoare, medii, grele' },
    ru: { name: 'Фитнес-резинки', note: 'Лёгкие, средние, тяжёлые' },
  },
  pullup_bar: { ro: { name: 'Bară de tracțiuni' }, ru: { name: 'Турник' } },
  dip_bars: { ro: { name: 'Bare paralele' }, ru: { name: 'Брусья' } },
  chair: { ro: { name: 'Scaun stabil' }, ru: { name: 'Устойчивый стул' } },
  bench: { ro: { name: 'Bancă' }, ru: { name: 'Скамья' } },
  step: { ro: { name: 'Step aerobic' }, ru: { name: 'Степ-платформа' } },
  stairs: { ro: { name: 'Scări' }, ru: { name: 'Лестница' } },
  jump_rope: { ro: { name: 'Coardă de sărit' }, ru: { name: 'Скакалка' } },
  treadmill: { ro: { name: 'Bandă de alergare' }, ru: { name: 'Беговая дорожка' } },
  running_route: {
    ro: { name: 'Traseu de alergare afară', note: 'Un parc, o alee, un stadion' },
    ru: { name: 'Маршрут для бега на улице', note: 'Парк, дорожка, стадион' },
  },
  exercise_bike: { ro: { name: 'Bicicletă fitness' }, ru: { name: 'Велотренажёр' } },
  rower: { ro: { name: 'Aparat de vâslit' }, ru: { name: 'Гребной тренажёр' } },
  foam_roller: { ro: { name: 'Rolă de masaj' }, ru: { name: 'Массажный ролик' } },
  ab_wheel: { ro: { name: 'Roată pentru abdomene' }, ru: { name: 'Ролик для пресса' } },
  yoga_block: { ro: { name: 'Bloc de yoga' }, ru: { name: 'Блок для йоги' } },
  fitness_ball: { ro: { name: 'Minge de fitness' }, ru: { name: 'Фитбол' } },
  medicine_ball: { ro: { name: 'Minge medicinală' }, ru: { name: 'Медбол' } },
  weighted_vest: { ro: { name: 'Vestă cu greutăți' }, ru: { name: 'Утяжелённый жилет' } },
  rings: { ro: { name: 'Inele de gimnastică' }, ru: { name: 'Гимнастические кольца' } },
  suspension: { ro: { name: 'Chingi de suspensie' }, ru: { name: 'Подвесные петли' } },
  parallettes: { ro: { name: 'Paralele mici' }, ru: { name: 'Мини-брусья' } },
  hand_grip: { ro: { name: 'Extensor de mână' }, ru: { name: 'Кистевой эспандер' } },
};

const LANGS = ['ro', 'ru'] as const;

/** A list in another language, item by item: what the catalog wrote is translated, anything else stays. */
function mapList(
  list: string[],
  translate: (item: string, index: number) => string | undefined,
): string[] | undefined {
  let found = false;
  const out = list.map((item, index) => {
    const value = translate(item, index);
    if (value) found = true;
    return value ?? item;
  });
  return found ? out : undefined;
}

/** A way or a piece by its English name, in another language. */
export const wayIn = (name: string, lang: 'ro' | 'ru'): string | undefined => WAYS[name]?.[lang];

/** A catalog preset's own translations: an equipment preset (name, note, pieces). */
export function equipmentPresetTranslations(preset: EquipmentPreset): Translations {
  const text = EQUIPMENT_TEXT[preset.kind];
  if (!text) return {};
  const out: Translations = {};
  for (const lang of LANGS) {
    const entry: Record<string, string | string[]> = { name: text[lang].name };
    if (text[lang].note) entry.note = text[lang].note!;
    const pieces = preset.pieces && mapList(preset.pieces.map((p) => p.name), (n) => wayIn(n, lang));
    if (pieces) entry.pieces = pieces;
    out[lang] = entry;
  }
  return out;
}

/**
 * The translations a copied catalog exercise gets, for what it still says as the catalog wrote it:
 * a renamed exercise keeps its own name in every language, an edited step stays as edited.
 */
export function exerciseRowTranslations(
  preset: ExercisePreset | undefined,
  row: { name: string; steps: string[]; variants: string[] },
): Translations {
  const text = preset ? EXERCISE_TEXT[preset.key] : undefined;
  const out: Translations = {};
  for (const lang of LANGS) {
    const entry: Record<string, string | string[]> = {};
    if (preset && text && row.name === preset.name) entry.name = text[lang].name;
    const steps =
      preset && text
        ? mapList(row.steps, (step) => {
            const at = preset.steps.indexOf(step);
            return at >= 0 ? text[lang].steps[at] : undefined;
          })
        : undefined;
    if (steps) entry.steps = steps;
    const variants = mapList(row.variants, (v) => wayIn(v, lang));
    if (variants) entry.variants = variants;
    if (Object.keys(entry).length) out[lang] = entry;
  }
  return out;
}

/** The same for equipment added from a preset (matched by kind): name, note and pieces. */
export function equipmentRowTranslations(
  preset: EquipmentPreset | undefined,
  row: { name: string; note: string; variants: Array<{ name: string }> },
): Translations {
  const text = preset ? EQUIPMENT_TEXT[preset.kind] : undefined;
  const out: Translations = {};
  for (const lang of LANGS) {
    const entry: Record<string, string | string[]> = {};
    if (preset && text && row.name === preset.name) entry.name = text[lang].name;
    if (preset?.note && text?.[lang].note && row.note === preset.note) entry.note = text[lang].note!;
    const pieces = mapList(
      row.variants.map((p) => p.name),
      (n) => wayIn(n, lang),
    );
    if (pieces) entry.variants = pieces;
    if (Object.keys(entry).length) out[lang] = entry;
  }
  return out;
}
