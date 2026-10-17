import { cleanTranslations, LOCALES, type Locale, type Translations } from '../../lib/i18n';

/**
 * The built-in catalog in Romanian and Russian, as written on Moldovan shelves: [ro, ru] per
 * preset, keyed by the preset's English name (its key, which is what a catalog item is stored as).
 * Brands keep their own name (Coca-Cola, Divin, Om). Kinds are translated per item, since they
 * agree with it: pâine neagră but orez negru, хлеб чёрный but фасоль белая. Kinds that are brands
 * or label names (Zero, Finlandia, Gouda) aren't listed and stay as they are.
 */

type Names = readonly [ro: string, ru: string];

export const PRESET_NAMES: Record<string, Names> = {
  // Produce
  Tomatoes: ['Roșii', 'Помидоры'],
  'Cherry tomatoes': ['Roșii cherry', 'Помидоры черри'],
  Cucumbers: ['Castraveți', 'Огурцы'],
  Carrots: ['Morcovi', 'Морковь'],
  Potatoes: ['Cartofi', 'Картофель'],
  Onions: ['Ceapă', 'Лук'],
  'Red onions': ['Ceapă roșie', 'Красный лук'],
  Garlic: ['Usturoi', 'Чеснок'],
  'Bell peppers': ['Ardei gras', 'Болгарский перец'],
  'Chili peppers': ['Ardei iute', 'Острый перец'],
  Lettuce: ['Salată verde', 'Салат'],
  Cabbage: ['Varză', 'Капуста'],
  Broccoli: ['Broccoli', 'Брокколи'],
  Mushrooms: ['Ciuperci', 'Грибы'],
  Eggplants: ['Vinete', 'Баклажаны'],
  Zucchini: ['Dovlecei', 'Кабачки'],
  Corn: ['Porumb', 'Кукуруза'],
  Avocados: ['Avocado', 'Авокадо'],
  Lemons: ['Lămâi', 'Лимоны'],
  Apples: ['Mere', 'Яблоки'],
  Bananas: ['Banane', 'Бананы'],
  Oranges: ['Portocale', 'Апельсины'],
  Strawberries: ['Căpșuni', 'Клубника'],
  Grapes: ['Struguri', 'Виноград'],
  Pears: ['Pere', 'Груши'],
  Watermelon: ['Pepene verde', 'Арбуз'],
  Cherries: ['Cireșe', 'Черешня'],
  Dill: ['Mărar', 'Укроп'],
  Parsley: ['Pătrunjel', 'Петрушка'],
  Basil: ['Busuioc', 'Базилик'],
  Spinach: ['Spanac', 'Шпинат'],
  Beetroot: ['Sfeclă', 'Свёкла'],
  Radishes: ['Ridichi', 'Редис'],
  'Green onions': ['Ceapă verde', 'Зелёный лук'],
  Leek: ['Praz', 'Лук-порей'],
  Celery: ['Țelină', 'Сельдерей'],
  Cilantro: ['Coriandru', 'Кинза'],
  Mint: ['Mentă', 'Мята'],
  Limes: ['Lime', 'Лаймы'],
  'Passion fruit': ['Fructul pasiunii', 'Маракуйя'],
  'Ginger root': ['Rădăcină de ghimbir', 'Корень имбиря'],
  Pumpkin: ['Dovleac', 'Тыква'],
  'Sweet potatoes': ['Cartofi dulci', 'Батат'],
  Plums: ['Prune', 'Сливы'],
  Peaches: ['Piersici', 'Персики'],
  Apricots: ['Caise', 'Абрикосы'],
  Kiwi: ['Kiwi', 'Киви'],
  Pomegranate: ['Rodie', 'Гранат'],
  Blueberries: ['Afine', 'Черника'],
  Raspberries: ['Zmeură', 'Малина'],
  // Bakery
  Bread: ['Pâine', 'Хлеб'],
  Baguette: ['Baghetă', 'Багет'],
  Croissants: ['Croissante', 'Круассаны'],
  Tortillas: ['Tortilla', 'Тортильи'],
  Plăcintă: ['Plăcintă', 'Плацинда'],
  // Meat and fish
  'Beef steak': ['Steak de vită', 'Говяжий стейк'],
  Pork: ['Carne de porc', 'Свинина'],
  'Chicken breast': ['Piept de pui', 'Куриная грудка'],
  'Chicken thighs': ['Pulpe de pui', 'Куриные бёдра'],
  'Whole chicken': ['Pui întreg', 'Целая курица'],
  'Minced meat': ['Carne tocată', 'Фарш'],
  Sausages: ['Cârnați', 'Колбаса'],
  Bacon: ['Bacon', 'Бекон'],
  Ham: ['Șuncă', 'Ветчина'],
  Turkey: ['Curcan', 'Индейка'],
  Lamb: ['Carne de miel', 'Баранина'],
  'Chicken wings': ['Aripioare de pui', 'Куриные крылышки'],
  'Chicken liver': ['Ficat de pui', 'Куриная печень'],
  Salami: ['Salam', 'Салями'],
  'Smoked meat': ['Afumături', 'Копчёности'],
  'Canned meat': ['Conservă de carne', 'Тушёнка'],
  'Liver pâté': ['Pateu de ficat', 'Печёночный паштет'],
  Salmon: ['Somon', 'Лосось'],
  'Fish fillet': ['File de pește', 'Рыбное филе'],
  Shrimp: ['Creveți', 'Креветки'],
  'Tuna (canned)': ['Ton (conservă)', 'Тунец (консервы)'],
  Herring: ['Scrumbie', 'Сельдь'],
  'Canned sardines': ['Sardine (conservă)', 'Сардины (консервы)'],
  'Crab sticks': ['Bețișoare de crab', 'Крабовые палочки'],
  'Canned salmon': ['Somon conservat', 'Горбуша консервированная'],
  'Mackerel (canned)': ['Scrumbie (conservă)', 'Скумбрия (консервы)'],
  Sprats: ['Șprot', 'Шпроты'],
  // Dairy and eggs
  Milk: ['Lapte', 'Молоко'],
  Eggs: ['Ouă', 'Яйца'],
  Cheese: ['Cașcaval', 'Сыр'],
  Feta: ['Brânză', 'Брынза'],
  Mozzarella: ['Mozzarella', 'Моцарелла'],
  Butter: ['Unt', 'Сливочное масло'],
  Yogurt: ['Iaurt', 'Йогурт'],
  'Sour cream': ['Smântână', 'Сметана'],
  Cream: ['Smântână lichidă', 'Сливки'],
  'Whipped cream': ['Frișcă', 'Взбитые сливки'],
  'Cottage cheese': ['Brânză de vaci', 'Творог'],
  Kefir: ['Chefir', 'Кефир'],
  Parmesan: ['Parmezan', 'Пармезан'],
  'Cream cheese': ['Brânză cremă', 'Сливочный сыр'],
  Mascarpone: ['Mascarpone', 'Маскарпоне'],
  Telemea: ['Telemea', 'Телемеа'],
  'Protein pudding': ['Budincă proteică', 'Протеиновый пудинг'],
  Skyr: ['Skyr', 'Скир'],
  // Frozen
  'Frozen vegetables': ['Legume congelate', 'Замороженные овощи'],
  'Mexican mix': ['Amestec mexican', 'Мексиканская смесь'],
  'Frozen spinach': ['Spanac congelat', 'Замороженный шпинат'],
  'Frozen berries': ['Fructe de pădure congelate', 'Замороженные ягоды'],
  'Ice cream': ['Înghețată', 'Мороженое'],
  Dumplings: ['Pelmeni', 'Пельмени'],
  'Ice cubes': ['Cuburi de gheață', 'Кубики льда'],
  'Frozen pizza': ['Pizza congelată', 'Замороженная пицца'],
  'Fish sticks': ['Bețișoare de pește', 'Рыбные палочки'],
  'French fries': ['Cartofi pai', 'Картофель фри'],
  // Pantry
  Rice: ['Orez', 'Рис'],
  Pasta: ['Paste', 'Макароны'],
  Flour: ['Făină', 'Мука'],
  Sugar: ['Zahăr', 'Сахар'],
  Oats: ['Fulgi de ovăz', 'Овсяные хлопья'],
  Buckwheat: ['Hrișcă', 'Гречка'],
  Lentils: ['Linte', 'Чечевица'],
  'Corn grits': ['Mălai', 'Кукурузная крупа'],
  'Canned beans': ['Fasole conservată', 'Фасоль консервированная'],
  'Canned tomatoes': ['Roșii conservate', 'Помидоры в собственном соку'],
  'Tomato paste': ['Pastă de tomate', 'Томатная паста'],
  'Sunflower oil': ['Ulei de floarea-soarelui', 'Подсолнечное масло'],
  'Olive oil': ['Ulei de măsline', 'Оливковое масло'],
  Honey: ['Miere', 'Мёд'],
  Walnuts: ['Nuci', 'Грецкие орехи'],
  Coffee: ['Cafea', 'Кофе'],
  Tea: ['Ceai', 'Чай'],
  Jam: ['Gem', 'Варенье'],
  'Breakfast cereal': ['Cereale pentru mic dejun', 'Сухие завтраки'],
  'Fruit purée': ['Piure de fructe', 'Фруктовое пюре'],
  Bulgur: ['Bulgur', 'Булгур'],
  Couscous: ['Cuscus', 'Кускус'],
  Quinoa: ['Quinoa', 'Киноа'],
  Semolina: ['Griș', 'Манная крупа'],
  Breadcrumbs: ['Pesmet', 'Панировочные сухари'],
  'Canned chickpeas': ['Năut (conservă)', 'Нут (консервы)'],
  'Canned corn': ['Porumb conservat', 'Кукуруза консервированная'],
  'Canned peas': ['Mazăre conservată', 'Зелёный горошек'],
  Olives: ['Măsline', 'Оливки'],
  Pickles: ['Castraveți murați', 'Маринованные огурцы'],
  'Pickled tomatoes': ['Roșii murate', 'Солёные помидоры'],
  Sauerkraut: ['Varză murată', 'Квашеная капуста'],
  'Coconut milk': ['Lapte de cocos', 'Кокосовое молоко'],
  'Chopped tomatoes': ['Roșii tăiate', 'Томаты резаные'],
  'Tomato sauce (canned)': ['Sos de roșii (conservă)', 'Томатный соус (консервы)'],
  'Canned red beans': ['Fasole roșie conservată', 'Красная фасоль консервированная'],
  'Beans in tomato sauce': ['Fasole în sos tomat', 'Фасоль в томатном соусе'],
  'Canned lentils': ['Linte conservată', 'Чечевица консервированная'],
  'Canned mushrooms': ['Ciuperci conservate', 'Грибы консервированные'],
  'Canned pineapple': ['Ananas conservat', 'Ананасы консервированные'],
  'Canned peaches': ['Piersici conservate', 'Персики консервированные'],
  Zacuscă: ['Zacuscă', 'Закуска'],
  'Eggplant caviar': ['Icre de vinete', 'Баклажанная икра'],
  Lecho: ['Lecio', 'Лечо'],
  Ajvar: ['Ajvar', 'Айвар'],
  'Protein powder': ['Proteină pudră', 'Протеин'],
  'Mass gainer': ['Gainer', 'Гейнер'],
  Creatine: ['Creatină', 'Креатин'],
  'Peanut butter': ['Unt de arahide', 'Арахисовая паста'],
  'Chocolate spread': ['Cremă de ciocolată', 'Шоколадная паста'],
  'Sunflower seeds': ['Semințe de floarea-soarelui', 'Семечки'],
  Almonds: ['Migdale', 'Миндаль'],
  Raisins: ['Stafide', 'Изюм'],
  'Dried apricots': ['Caise uscate', 'Курага'],
  Prunes: ['Prune uscate', 'Чернослив'],
  Muesli: ['Musli', 'Мюсли'],
  'Instant coffee': ['Cafea solubilă', 'Растворимый кофе'],
  // Spices, sauces, baking
  Salt: ['Sare', 'Соль'],
  'Black pepper': ['Piper negru', 'Чёрный перец'],
  Paprika: ['Boia', 'Паприка'],
  Ketchup: ['Ketchup', 'Кетчуп'],
  Mayonnaise: ['Maioneză', 'Майонез'],
  Mustard: ['Muștar', 'Горчица'],
  'Soy sauce': ['Sos de soia', 'Соевый соус'],
  Vinegar: ['Oțet', 'Уксус'],
  Oregano: ['Oregano', 'Орегано'],
  'Dried basil': ['Busuioc uscat', 'Сушёный базилик'],
  Thyme: ['Cimbru', 'Тимьян'],
  Rosemary: ['Rozmarin', 'Розмарин'],
  'Bay leaves': ['Foi de dafin', 'Лавровый лист'],
  'Dried dill': ['Mărar uscat', 'Сушёный укроп'],
  'Mixed herbs': ['Ierburi provensale', 'Прованские травы'],
  Cumin: ['Chimion', 'Зира'],
  'Ground coriander': ['Coriandru măcinat', 'Молотый кориандр'],
  Cinnamon: ['Scorțișoară', 'Корица'],
  Turmeric: ['Turmeric', 'Куркума'],
  'Curry powder': ['Curry', 'Карри'],
  'Chili flakes': ['Fulgi de chili', 'Хлопья чили'],
  'Smoked paprika': ['Boia afumată', 'Копчёная паприка'],
  'Garlic powder': ['Usturoi granulat', 'Чесночный порошок'],
  'Onion powder': ['Ceapă granulată', 'Луковый порошок'],
  'Ground ginger': ['Ghimbir măcinat', 'Молотый имбирь'],
  Nutmeg: ['Nucșoară', 'Мускатный орех'],
  Cloves: ['Cuișoare', 'Гвоздика'],
  Allspice: ['Ienibahar', 'Душистый перец'],
  Cardamom: ['Cardamom', 'Кардамон'],
  Vegeta: ['Vegeta', 'Вегета'],
  'Khmeli-suneli': ['Hmeli-suneli', 'Хмели-сунели'],
  Vanilla: ['Vanilie', 'Ваниль'],
  'Hot sauce': ['Sos iute', 'Острый соус'],
  Adjika: ['Ajika', 'Аджика'],
  Horseradish: ['Hrean', 'Хрен'],
  'BBQ sauce': ['Sos barbecue', 'Соус барбекю'],
  Pesto: ['Pesto', 'Песто'],
  'Tomato sauce': ['Sos de roșii', 'Томатный соус'],
  'Balsamic vinegar': ['Oțet balsamic', 'Бальзамический уксус'],
  'Apple cider vinegar': ['Oțet de mere', 'Яблочный уксус'],
  'Baking soda': ['Bicarbonat de sodiu', 'Пищевая сода'],
  'Baking powder': ['Praf de copt', 'Разрыхлитель'],
  'Dry yeast': ['Drojdie uscată', 'Сухие дрожжи'],
  'Cocoa powder': ['Cacao', 'Какао'],
  'Corn starch': ['Amidon de porumb', 'Кукурузный крахмал'],
  'Vanilla sugar': ['Zahăr vanilat', 'Ванильный сахар'],
  'Powdered sugar': ['Zahăr pudră', 'Сахарная пудра'],
  // Drinks
  Water: ['Apă', 'Вода'],
  'Sparkling water': ['Apă gazoasă', 'Газированная вода'],
  'Mineral water': ['Apă minerală', 'Минеральная вода'],
  Juice: ['Suc', 'Сок'],
  'Coca-Cola': ['Coca-Cola', 'Coca-Cola'],
  Pepsi: ['Pepsi', 'Pepsi'],
  Sprite: ['Sprite', 'Sprite'],
  Fanta: ['Fanta', 'Fanta'],
  Mirinda: ['Mirinda', 'Mirinda'],
  'Mountain Dew': ['Mountain Dew', 'Mountain Dew'],
  Schweppes: ['Schweppes', 'Schweppes'],
  Fuzetea: ['Fuzetea', 'Fuzetea'],
  'Lipton Ice Tea': ['Lipton Ice Tea', 'Lipton Ice Tea'],
  Nestea: ['Nestea', 'Nestea'],
  Topic: ['Topic', 'Topic'],
  Baban: ['Baban', 'Baban'],
  'Dr Pepper': ['Dr Pepper', 'Dr Pepper'],
  '7UP': ['7UP', '7UP'],
  Soda: ['Băutură carbogazoasă', 'Газировка'],
  Lemonade: ['Limonadă', 'Лимонад'],
  'Iced tea': ['Ceai rece', 'Холодный чай'],
  'Energy drink': ['Energizant', 'Энергетик'],
  Kvass: ['Cvas', 'Квас'],
  Compote: ['Compot', 'Компот'],
  'Kefir drink': ['Ayran', 'Айран'],
  'Oat milk': ['Lapte de ovăz', 'Овсяное молоко'],
  Wine: ['Vin', 'Вино'],
  'Sparkling wine': ['Vin spumant', 'Игристое вино'],
  Vodka: ['Vodcă', 'Водка'],
  Divin: ['Divin', 'Дивин'],
  Whisky: ['Whisky', 'Виски'],
  Rum: ['Rom', 'Ром'],
  Gin: ['Gin', 'Джин'],
  Tequila: ['Tequila', 'Текила'],
  Liqueur: ['Lichior', 'Ликёр'],
  Vermouth: ['Vermut', 'Вермут'],
  'Tonic water': ['Apă tonică', 'Тоник'],
  Syrup: ['Sirop', 'Сироп'],
  Beer: ['Bere', 'Пиво'],
  // Snacks and sweets
  Sprinkles: ['Ornamente de cofetărie', 'Посыпка'],
  'Chocolate chips': ['Picături de ciocolată', 'Шоколадные капли'],
  Marshmallows: ['Marshmallow', 'Маршмеллоу'],
  Chocolate: ['Ciocolată', 'Шоколад'],
  Cookies: ['Biscuiți', 'Печенье'],
  Chips: ['Chipsuri', 'Чипсы'],
  Popcorn: ['Floricele', 'Попкорн'],
  Croutons: ['Pesmeți', 'Сухарики'],
  'Rice cakes': ['Galete de orez', 'Рисовые хлебцы'],
  'Granola bars': ['Batoane de cereale', 'Злаковые батончики'],
  Hummus: ['Humus', 'Хумус'],
  Cake: ['Tort', 'Торт'],
  Pastries: ['Prăjituri', 'Пирожные'],
  Pizza: ['Pizza', 'Пицца'],
  'Protein bar': ['Baton proteic', 'Протеиновый батончик'],
  Crackers: ['Crackeri', 'Крекеры'],
  // The house
  Shampoo: ['Șampon', 'Шампунь'],
  Conditioner: ['Balsam de păr', 'Бальзам для волос'],
  'Shower gel': ['Gel de duș', 'Гель для душа'],
  'Hand soap': ['Săpun lichid', 'Жидкое мыло'],
  'Soap bar': ['Săpun', 'Мыло'],
  Toothpaste: ['Pastă de dinți', 'Зубная паста'],
  Toothbrush: ['Periuță de dinți', 'Зубная щётка'],
  Mouthwash: ['Apă de gură', 'Ополаскиватель для рта'],
  'Dental floss': ['Ață dentară', 'Зубная нить'],
  Deodorant: ['Deodorant', 'Дезодорант'],
  'Razor blades': ['Lame de ras', 'Лезвия для бритья'],
  'Shaving foam': ['Spumă de ras', 'Пена для бритья'],
  'Cotton pads': ['Dischete demachiante', 'Ватные диски'],
  'Cotton swabs': ['Bețișoare de urechi', 'Ватные палочки'],
  'Wet wipes': ['Șervețele umede', 'Влажные салфетки'],
  'Hand cream': ['Cremă de mâini', 'Крем для рук'],
  Sunscreen: ['Cremă de protecție solară', 'Солнцезащитный крем'],
  'Toilet paper': ['Hârtie igienică', 'Туалетная бумага'],
  'Paper towels': ['Prosoape de hârtie', 'Бумажные полотенца'],
  Tissues: ['Batiste de hârtie', 'Бумажные платочки'],
  Napkins: ['Șervețele', 'Салфетки'],
  'Dish soap': ['Detergent de vase', 'Средство для посуды'],
  'Dishwasher tablets': ['Tablete pentru mașina de vase', 'Таблетки для посудомойки'],
  'Dish brush': ['Perie de vase', 'Щётка для посуды'],
  Sponges: ['Bureți', 'Губки'],
  'All-purpose cleaner': ['Soluție universală', 'Универсальное средство'],
  'Glass cleaner': ['Soluție pentru geamuri', 'Средство для стёкол'],
  Bleach: ['Înălbitor', 'Отбеливатель'],
  'Toilet cleaner': ['Soluție pentru WC', 'Средство для унитаза'],
  'Floor cleaner': ['Detergent pentru pardoseli', 'Средство для пола'],
  'Laundry detergent': ['Detergent de rufe', 'Средство для стирки'],
  'Laundry pods': ['Capsule de rufe', 'Капсулы для стирки'],
  'Fabric softener': ['Balsam de rufe', 'Кондиционер для белья'],
  'Stain remover': ['Soluție pentru pete', 'Пятновыводитель'],
  'Cat litter': ['Nisip pentru pisici', 'Наполнитель для лотка'],
  'Litter box deodorizer': ['Deodorant pentru litieră', 'Дезодорант для лотка'],
  'Waste bags': ['Pungi pentru litieră', 'Пакеты для лотка'],
  'Pet food': ['Hrană pentru animale', 'Корм для животных'],
  'Trash bags': ['Saci de gunoi', 'Мешки для мусора'],
  'Light bulbs': ['Becuri', 'Лампочки'],
  Batteries: ['Baterii', 'Батарейки'],
  'Air freshener': ['Odorizant', 'Освежитель воздуха'],
  Candles: ['Lumânări', 'Свечи'],
  'Water filter': ['Filtru de apă', 'Фильтр для воды'],
  'Aluminium foil': ['Folie de aluminiu', 'Фольга'],
  'Cling film': ['Folie alimentară', 'Пищевая плёнка'],
  'Baking paper': ['Hârtie de copt', 'Пергамент для выпечки'],
};

/** Kinds, per item: [ro, ru], agreeing with the item. */
export const VARIANT_NAMES: Record<string, Record<string, Names>> = {
  Apples: { Golden: ['Golden', 'Голден'], Red: ['Roșii', 'Красные'], Green: ['Verzi', 'Зелёные'] },
  Bread: {
    White: ['Albă', 'Белый'],
    Brown: ['Intermediară', 'Серый'],
    Rye: ['De secară', 'Ржаной'],
    'Whole grain': ['Integrală', 'Цельнозерновой'],
    Seeded: ['Cu semințe', 'С семенами'],
    Toast: ['Pentru toast', 'Тостовый'],
    Black: ['Neagră', 'Чёрный'],
    Bran: ['Cu tărâțe', 'С отрубями'],
  },
  'Beef steak': {
    Ribeye: ['Antricot', 'Рибай'],
    Sirloin: ['Vrăbioară', 'Стриплойн'],
    Tenderloin: ['Mușchi', 'Вырезка'],
    'T-bone': ['T-bone', 'Ти-бон'],
  },
  'Minced meat': {
    Beef: ['De vită', 'Говяжий'],
    Pork: ['De porc', 'Свиной'],
    Mixed: ['Mixtă', 'Смешанный'],
    Chicken: ['De pui', 'Куриный'],
  },
  Sausages: {
    Boiled: ['Fierți', 'Варёная'],
    Smoked: ['Afumați', 'Копчёная'],
    'Hot dogs': ['Crenvurști', 'Сосиски'],
  },
  'Tuna (canned)': {
    'In oil': ['În ulei', 'В масле'],
    'In water': ['În suc propriu', 'В собственном соку'],
    Chunks: ['Bucăți', 'Кусочками'],
    Salad: ['Salată', 'Салат'],
  },
  Milk: {
    Barista: ['Barista', 'Бариста'],
    'Lactose-free': ['Fără lactoză', 'Безлактозное'],
    Oat: ['De ovăz', 'Овсяное'],
    Almond: ['De migdale', 'Миндальное'],
  },
  Cheese: {
    Gouda: ['Gouda', 'Гауда'],
    Cheddar: ['Cheddar', 'Чеддер'],
    Edam: ['Edam', 'Эдам'],
    Maasdam: ['Maasdam', 'Маасдам'],
    Processed: ['Topit', 'Плавленый'],
    Smoked: ['Afumat', 'Копчёный'],
  },
  Yogurt: {
    Plain: ['Natural', 'Натуральный'],
    Greek: ['Grecesc', 'Греческий'],
    Fruit: ['Cu fructe', 'Фруктовый'],
  },
  Cream: { '33% (for whipping)': ['33% (pentru frișcă)', '33% (для взбивания)'] },
  Sprinkles: {
    Chocolate: ['De ciocolată', 'Шоколадная'],
    'Cinnamon sugar': ['Zahăr cu scorțișoară', 'Сахар с корицей'],
    Colourful: ['Colorate', 'Цветная'],
  },
  Rice: {
    'Long grain': ['Bob lung', 'Длиннозёрный'],
    Round: ['Bob rotund', 'Круглозёрный'],
    Basmati: ['Basmati', 'Басмати'],
    Jasmine: ['Jasmine', 'Жасмин'],
    'Sushi rice': ['Pentru sushi', 'Для суши'],
    Brown: ['Brun', 'Бурый'],
    Parboiled: ['Parboiled', 'Пропаренный'],
    Arborio: ['Arborio', 'Арборио'],
    Wild: ['Sălbatic', 'Дикий'],
    Black: ['Negru', 'Чёрный'],
  },
  Pasta: {
    Spaghetti: ['Spaghete', 'Спагетти'],
    Penne: ['Penne', 'Пенне'],
    Fusilli: ['Fusilli', 'Фузилли'],
    Farfalle: ['Farfalle', 'Фарфалле'],
    Ravioli: ['Ravioli', 'Равиоли'],
    Cannelloni: ['Cannelloni', 'Каннеллони'],
    Lasagne: ['Lasagna', 'Лазанья'],
    Tagliatelle: ['Tagliatelle', 'Тальятелле'],
    Linguine: ['Linguine', 'Лингвини'],
    Rigatoni: ['Rigatoni', 'Ригатони'],
    Conchiglie: ['Conchiglie', 'Ракушки'],
    Orzo: ['Orzo', 'Орзо'],
    'Whole wheat': ['Integrale', 'Цельнозерновые'],
    'Gluten-free': ['Fără gluten', 'Без глютена'],
  },
  'Canned beans': {
    White: ['Albă', 'Белая'],
    Red: ['Roșie', 'Красная'],
    Mixed: ['Mix', 'Микс'],
  },
  'Sunflower oil': {
    Refined: ['Rafinat', 'Рафинированное'],
    Unrefined: ['Nerafinat', 'Нерафинированное'],
  },
  'Olive oil': {
    'Extra virgin': ['Extravirgin', 'Extra Virgin'],
    Refined: ['Rafinat', 'Рафинированное'],
  },
  Coffee: {
    Beans: ['Boabe', 'В зёрнах'],
    Ground: ['Măcinată', 'Молотый'],
    Capsules: ['Capsule', 'В капсулах'],
  },
  Tea: {
    Black: ['Negru', 'Чёрный'],
    Green: ['Verde', 'Зелёный'],
    'Earl Grey (bergamot)': ['Earl Grey (bergamotă)', 'Эрл Грей (бергамот)'],
    'Green, 1001 Nights': ['Verde, 1001 de nopți', 'Зелёный, 1001 ночь'],
    Jasmine: ['Iasomie', 'Жасминовый'],
    Chamomile: ['Mușețel', 'Ромашковый'],
    Mint: ['Mentă', 'Мятный'],
    Herbal: ['Din plante', 'Травяной'],
    Fruit: ['De fructe', 'Фруктовый'],
    Hibiscus: ['Hibiscus', 'Каркаде'],
    Rooibos: ['Rooibos', 'Ройбуш'],
    'Ginger-lemon': ['Ghimbir și lămâie', 'Имбирь-лимон'],
  },
  'Sparkling water': {
    'Lightly sparkling': ['Slab carbogazoasă', 'Слабогазированная'],
    Sparkling: ['Carbogazoasă', 'Газированная'],
    Borjomi: ['Borjomi', 'Боржоми'],
  },
  'Mineral water': {
    Borjomi: ['Borjomi', 'Боржоми'],
    Essentuki: ['Essentuki', 'Ессентуки'],
    Narzan: ['Narzan', 'Нарзан'],
  },
  Juice: {
    Apple: ['De mere', 'Яблочный'],
    Orange: ['De portocale', 'Апельсиновый'],
    'Mango-peach': ['Mango-piersică', 'Манго-персик'],
    Multivitamin: ['Multivitamine', 'Мультивитамин'],
    Multifruit: ['Multifruct', 'Мультифрукт'],
    Peach: ['De piersici', 'Персиковый'],
    'Peach-banana': ['Piersică-banană', 'Персик-банан'],
    Banana: ['De banane', 'Банановый'],
    Cherry: ['De vișine', 'Вишнёвый'],
    Grape: ['De struguri', 'Виноградный'],
    Pineapple: ['De ananas', 'Ананасовый'],
    Pomegranate: ['De rodie', 'Гранатовый'],
    Grapefruit: ['De grepfrut', 'Грейпфрутовый'],
    Tomato: ['De roșii', 'Томатный'],
    Carrot: ['De morcovi', 'Морковный'],
  },
  Fanta: {
    Orange: ['Portocale', 'Апельсин'],
    Mandarin: ['Mandarină', 'Мандарин'],
    Lemon: ['Lămâie', 'Лимон'],
    'Raspberry Zero': ['Zmeură Zero', 'Малина Zero'],
    Mango: ['Mango', 'Манго'],
  },
  'Lipton Ice Tea': {
    Peach: ['Piersică', 'Персик'],
    Green: ['Verde', 'Зелёный'],
    Lemon: ['Lămâie', 'Лимон'],
  },
  Nestea: {
    Peach: ['Piersică', 'Персик'],
    'Mango Pineapple': ['Mango-ananas', 'Манго-ананас'],
    'Forest Fruits': ['Fructe de pădure', 'Лесные ягоды'],
    'Green Apple': ['Măr verde', 'Зелёное яблоко'],
  },
  Topic: {
    Lemonade: ['Limonadă', 'Лимонад'],
    Pineapple: ['Ananas', 'Ананас'],
    'Cream Soda': ['Cream Soda', 'Крем-сода'],
  },
  Lemonade: {
    Lemon: ['Cu lămâie', 'Лимонный'],
    Mint: ['Cu mentă', 'Мятный'],
    Strawberry: ['Cu căpșuni', 'Клубничный'],
  },
  'Iced tea': {
    Lemon: ['Cu lămâie', 'Лимонный'],
    Peach: ['Cu piersici', 'Персиковый'],
    'Green tea': ['Ceai verde', 'Зелёный чай'],
  },
  Compote: {
    Cherry: ['De vișine', 'Вишнёвый'],
    Apple: ['De mere', 'Яблочный'],
    'Mixed fruit': ['Din fructe asortate', 'Ассорти'],
  },
  Wine: {
    'Red dry': ['Roșu sec', 'Красное сухое'],
    'White dry': ['Alb sec', 'Белое сухое'],
    Rosé: ['Roze', 'Розовое'],
    'Red semi-sweet': ['Roșu demidulce', 'Красное полусладкое'],
    'White semi-sweet': ['Alb demidulce', 'Белое полусладкое'],
  },
  'Sparkling wine': {
    Brut: ['Brut', 'Брют'],
    'Semi-dry': ['Demisec', 'Полусухое'],
    'Semi-sweet': ['Demidulce', 'Полусладкое'],
    Prosecco: ['Prosecco', 'Просекко'],
  },
  Vodka: {
    Khortytsa: ['Khortytsa', 'Хортица'],
    'Green Mark': ['Green Mark', 'Зелёная марка'],
    'Russian Standard': ['Russian Standard', 'Русский Стандарт'],
  },
  Divin: {
    '3 years': ['3 ani', '3 года'],
    '5 years': ['5 ani', '5 лет'],
    '10 years': ['10 ani', '10 лет'],
  },
  Rum: { White: ['Alb', 'Белый'], Dark: ['Negru', 'Тёмный'], Spiced: ['Condimentat', 'Пряный'] },
  Liqueur: {
    Coffee: ['De cafea', 'Кофейный'],
    Amaretto: ['Amaretto', 'Амаретто'],
    Cream: ['Cremos', 'Сливочный'],
  },
  Syrup: {
    Vanilla: ['Vanilie', 'Ванильный'],
    Caramel: ['Caramel', 'Карамельный'],
    'Salted caramel': ['Caramel sărat', 'Солёная карамель'],
    Hazelnut: ['Alune de pădure', 'Лесной орех'],
    'Irish cream': ['Irish cream', 'Айриш крим'],
    Coconut: ['Cocos', 'Кокосовый'],
    Maracuya: ['Maracuja', 'Маракуйя'],
    Grenadine: ['Grenadină', 'Гренадин'],
    Mint: ['Mentă', 'Мятный'],
    Strawberry: ['Căpșuni', 'Клубничный'],
    Chocolate: ['Ciocolată', 'Шоколадный'],
    Cherry: ['Vișine', 'Вишнёвый'],
  },
  'Fruit purée': {
    Mango: ['Mango', 'Манго'],
    Maracuya: ['Maracuja', 'Маракуйя'],
    Strawberry: ['Căpșuni', 'Клубника'],
    Raspberry: ['Zmeură', 'Малина'],
    Peach: ['Piersici', 'Персик'],
  },
  Chocolate: {
    Milk: ['Cu lapte', 'Молочный'],
    Dark: ['Neagră', 'Тёмный'],
    White: ['Albă', 'Белый'],
  },
  Shampoo: {
    Normal: ['Pentru păr normal', 'Для нормальных волос'],
    'Anti-dandruff': ['Antimătreață', 'От перхоти'],
    'For dry hair': ['Pentru păr uscat', 'Для сухих волос'],
    Kids: ['Pentru copii', 'Детский'],
  },
  'Cat litter': {
    Clumping: ['Aglomerant', 'Комкующийся'],
    Tofu: ['Tofu', 'Тофу'],
    Silica: ['Silicagel', 'Силикагелевый'],
    Wood: ['Din lemn', 'Древесный'],
  },
  'Waste bags': { Universal: ['Universale', 'Универсальные'] },
  'Pet food': {
    Dry: ['Uscată', 'Сухой'],
    Wet: ['Umedă', 'Влажный'],
    Treats: ['Recompense', 'Лакомства'],
  },
  'Trash bags': { '35 l': ['35 l', '35 л'], '60 l': ['60 l', '60 л'], '120 l': ['120 l', '120 л'] },
  'Canned corn': { Sweet: ['Dulce', 'Сладкая'], 'Baby corn': ['Mini porumb', 'Мини-кукуруза'] },
  Cake: {
    'Honey cake': ['Medovik', 'Медовик'],
    Napoleon: ['Napoleon', 'Наполеон'],
    Chocolate: ['De ciocolată', 'Шоколадный'],
    Cheesecake: ['Cheesecake', 'Чизкейк'],
  },
  Plăcintă: {
    Cheese: ['Cu brânză', 'С брынзой'],
    Potato: ['Cu cartofi', 'С картошкой'],
    Cabbage: ['Cu varză', 'С капустой'],
    Pumpkin: ['Cu dovleac', 'С тыквой'],
    Cherry: ['Cu vișine', 'С вишней'],
  },
  Pizza: {
    Margherita: ['Margherita', 'Маргарита'],
    Pepperoni: ['Pepperoni', 'Пепперони'],
    'Four cheeses': ['Patru brânzeturi', 'Четыре сыра'],
  },
  'Chopped tomatoes': {
    Plain: ['Simple', 'Без добавок'],
    'With basil': ['Cu busuioc', 'С базиликом'],
    'With garlic': ['Cu usturoi', 'С чесноком'],
    'With chili': ['Cu chili', 'С чили'],
  },
  Sprats: { 'In oil': ['În ulei', 'В масле'], Smoked: ['Afumat', 'Копчёные'] },
  'Canned meat': {
    Beef: ['De vită', 'Говяжья'],
    Pork: ['De porc', 'Свиная'],
    Chicken: ['De pui', 'Куриная'],
  },
  Zacuscă: {
    Eggplant: ['Cu vinete', 'С баклажанами'],
    Pepper: ['Cu ardei', 'С перцем'],
    Mushroom: ['Cu ciuperci', 'С грибами'],
  },
  'Protein powder': {
    'Whey, vanilla': ['Zer, vanilie', 'Сывороточный, ваниль'],
    'Whey, chocolate': ['Zer, ciocolată', 'Сывороточный, шоколад'],
    'Whey, unflavoured': ['Zer, fără aromă', 'Сывороточный, без вкуса'],
    'Whey isolate': ['Izolat din zer', 'Изолят сыворотки'],
    Casein: ['Cazeină', 'Казеин'],
    'Vegan (pea)': ['Vegan (mazăre)', 'Веганский (гороховый)'],
    'Egg white': ['Albuș de ou', 'Яичный белок'],
  },
  'Protein bar': {
    Chocolate: ['Ciocolată', 'Шоколад'],
    Peanut: ['Arahide', 'Арахис'],
    'Cookies & cream': ['Biscuiți și cremă', 'Печенье со сливками'],
    'Low sugar': ['Cu puțin zahăr', 'Мало сахара'],
  },
};

/** Kitchenware presets: [ro, ru]. */
export const TOOL_NAMES: Record<string, Names> = {
  'Big pot': ['Oală mare', 'Большая кастрюля'],
  Pot: ['Oală', 'Кастрюля'],
  Saucepan: ['Crăticioară', 'Ковш'],
  'Frying pan': ['Tigaie', 'Сковорода'],
  Wok: ['Wok', 'Вок'],
  Grill: ['Grătar', 'Гриль'],
  Steamer: ['Vas pentru abur', 'Пароварка'],
  'Baking tray': ['Tavă', 'Противень'],
  'Baking dish': ['Formă de copt', 'Форма для запекания'],
  'Muffin tin': ['Formă de brioșe', 'Форма для маффинов'],
  'Cake tin': ['Formă de tort', 'Форма для торта'],
  'Rolling pin': ['Sucitor', 'Скалка'],
  'Mixing bowl': ['Bol', 'Миска'],
  'Cutting board': ['Tocător', 'Разделочная доска'],
  'Chef’s knife': ['Cuțit de bucătar', 'Поварской нож'],
  'Ceramic knife': ['Cuțit ceramic', 'Керамический нож'],
  Knife: ['Cuțit', 'Нож'],
  'Bread knife': ['Cuțit de pâine', 'Нож для хлеба'],
  Colander: ['Strecurătoare', 'Дуршлаг'],
  Whisk: ['Tel', 'Венчик'],
  Grater: ['Răzătoare', 'Тёрка'],
  Peeler: ['Curățător', 'Овощечистка'],
  Ladle: ['Polonic', 'Половник'],
  Spatula: ['Paletă', 'Лопатка'],
  Tongs: ['Clește', 'Щипцы'],
  'Can opener': ['Deschizător de conserve', 'Консервный нож'],
  'Garlic press': ['Presă de usturoi', 'Чесночница'],
  'Salad spinner': ['Uscător de salată', 'Сушилка для салата'],
  'Measuring cup': ['Cană gradată', 'Мерный стакан'],
  Blender: ['Blender', 'Блендер'],
  Mixer: ['Mixer', 'Миксер'],
  'Air fryer': ['Friteuză cu aer', 'Аэрогриль'],
  'Rice cooker': ['Aparat de gătit orez', 'Рисоварка'],
  'Slow cooker': ['Multicooker', 'Мультиварка'],
  'Pressure cooker': ['Oală sub presiune', 'Скороварка'],
  'Coffee machine': ['Espressor', 'Кофемашина'],
  'French press': ['Presă de cafea', 'Френч-пресс'],
  'Electric kettle': ['Fierbător', 'Электрочайник'],
  Microwave: ['Cuptor cu microunde', 'Микроволновка'],
  Toaster: ['Prăjitor de pâine', 'Тостер'],
  Oven: ['Cuptor', 'Духовка'],
  'Kitchen scale': ['Cântar de bucătărie', 'Кухонные весы'],
  'Cocktail shaker': ['Shaker', 'Шейкер'],
  Jigger: ['Jigger', 'Джиггер'],
  'Ice cube tray': ['Formă de gheață', 'Форма для льда'],
  Glasses: ['Pahare', 'Стаканы'],
  'Wine glasses': ['Pahare de vin', 'Бокалы'],
  Mugs: ['Căni', 'Кружки'],
  Plates: ['Farfurii', 'Тарелки'],
  Bowls: ['Boluri', 'Глубокие тарелки'],
  Cutlery: ['Tacâmuri', 'Столовые приборы'],
  'Lunch box': ['Caserolă', 'Ланчбокс'],
  'Food flask': ['Termos pentru mâncare', 'Пищевой термос'],
  'Water bottle': ['Sticlă de apă', 'Бутылка для воды'],
  'Baking paper': ['Hârtie de copt', 'Пергамент'],
  'Aluminium foil': ['Folie de aluminiu', 'Фольга'],
  'Cling film': ['Folie alimentară', 'Пищевая плёнка'],
  'Zip bags': ['Pungi cu fermoar', 'Зип-пакеты'],
  'Paper towels': ['Prosoape de hârtie', 'Бумажные полотенца'],
  Napkins: ['Șervețele', 'Салфетки'],
  Toothpicks: ['Scobitori', 'Зубочистки'],
  Skewers: ['Bețișoare pentru frigărui', 'Шпажки'],
  'Muffin cups': ['Forme de hârtie', 'Бумажные формочки'],
  'Paper cups': ['Pahare de unică folosință', 'Одноразовые стаканы'],
  Pens: ['Pixuri', 'Ручки'],
  Scissors: ['Foarfece', 'Ножницы'],
};

/** Titles the server gives a meal eaten out (meals.ts OUT_TITLE), by their English. */
export const OUT_TITLE_NAMES: Record<string, Names> = {
  Restaurant: ['Restaurant', 'Ресторан'],
  'Ordered in': ['Livrare', 'Доставка'],
  'At a party': ['La petrecere', 'На празднике'],
  'At work': ['La serviciu', 'На работе'],
  'Eaten out': ['În oraș', 'Вне дома'],
};

/** What leftovers of a dish are called: "Borscht (leftovers)". */
export const LEFTOVERS: Record<Locale, string> = {
  en: 'leftovers',
  ro: 'resturi',
  ru: 'остатки',
};

const pick = (names: Names, locale: Locale) => (locale === 'ro' ? names[0] : names[1]);

/**
 * A meal's (or a meal part's) title in other languages: the recipe's title in them when the meal is
 * called after its recipe; the server's own words for "Restaurant", "At work"…; the parts' titles
 * for "Omelette + Coffee"; and, above all of these, what people wrote for it (`stored`).
 */
export function mealTitleTranslations(meal: {
  title: string;
  stored?: Translations | null;
  recipeTitle?: string | null;
  recipeTranslations?: Translations | null;
  parts?: Array<{ title: string; translations: Translations }>;
}): Translations {
  let derived: Translations = {};
  const out = OUT_TITLE_NAMES[meal.title];
  if (out) {
    derived = { ro: { title: out[0] }, ru: { title: out[1] } };
  } else if (meal.recipeTitle && meal.title === meal.recipeTitle) {
    derived = onlyFields(meal.recipeTranslations, ['title']);
  } else if (
    meal.parts &&
    meal.parts.length > 1 &&
    meal.title === meal.parts.map((part) => part.title).join(' + ')
  ) {
    for (const locale of LOCALES) {
      const titles = meal.parts.map(
        (part) => fieldIn(part.translations, 'title', locale) ?? part.title,
      );
      if (titles.some((title, index) => title !== meal.parts![index]!.title))
        derived[locale] = { title: titles.join(' + ') };
    }
  }
  return combine(derived, meal.stored);
}

function namesOf(table: Record<string, Names>, key: string): Translations {
  const names = table[key];
  if (!names) return {};
  return { en: { name: key }, ro: { name: names[0] }, ru: { name: names[1] } };
}

/** A catalog item's name in all three languages, by its key (the English catalog name); {} if none. */
export const presetTranslations = (key: string): Translations => namesOf(PRESET_NAMES, key);

/** A kitchenware preset's name in all three languages; {} if none. */
export const toolTranslations = (key: string): Translations => namesOf(TOOL_NAMES, key);

/** The other-language names of a catalog item (for matching what people type). */
export const presetLocalNames = (key: string): string[] => [...(PRESET_NAMES[key] ?? [])];
export const toolLocalNames = (key: string): string[] => [...(TOOL_NAMES[key] ?? [])];

/** A kind of a catalog item in a language, or null when it reads the same (a brand, Zero). */
export function variantName(item: string, variant: string, locale: Locale): string | null {
  if (locale === 'en') return null;
  const kinds = VARIANT_NAMES[item];
  if (!kinds) return null;
  const names =
    kinds[variant] ??
    Object.entries(kinds).find(([key]) => key.toLowerCase() === variant.toLowerCase())?.[1];
  return names ? pick(names, locale) : null;
}

/**
 * The household's own names for an item's kinds (products.variant_names), per language, keyed by
 * the kind as stored: { ro: { "Greek 2%": "Grecesc 2%" } }. They win over the catalog's.
 */
export type KindNames = Partial<Record<Locale, Record<string, string>>>;

const sameKind = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** A kind in a language: the household's name for it, else the catalog's, else null (as stored). */
export function kindName(
  item: string,
  variant: string,
  locale: Locale,
  own?: KindNames | null,
): string | null {
  const names = own?.[locale];
  const mine = names
    ? (names[variant] ?? Object.entries(names).find(([key]) => sameKind(key, variant))?.[1])
    : undefined;
  return mine || variantName(item, variant, locale);
}

/**
 * Merges names for kinds into the stored ones, kind by kind. A name that reads as the kind would
 * anyway (the catalog's word, or the kind itself) or an empty one clears the household's own.
 */
export function mergeKindNames(
  item: string,
  stored: KindNames | null | undefined,
  update: KindNames | null | undefined,
): KindNames {
  const out: KindNames = {};
  for (const locale of LOCALES) {
    const names: Record<string, string> = { ...(stored?.[locale] ?? {}) };
    for (const [kind, raw] of Object.entries(update?.[locale] ?? {})) {
      for (const key of Object.keys(names)) if (sameKind(key, kind)) delete names[key];
      const name = raw.trim();
      if (name && name !== (variantName(item, kind, locale) ?? kind)) names[kind.trim()] = name;
    }
    if (Object.keys(names).length) out[locale] = names;
  }
  return out;
}

/** Every name a kind of an item goes by: as stored, and in each language. */
export function variantForms(item: string, variant: string, own?: KindNames | null): string[] {
  const forms = [variant];
  for (const locale of LOCALES) {
    const name = kindName(item, variant, locale, own);
    if (name && !forms.includes(name)) forms.push(name);
  }
  return forms;
}

/**
 * What an item shows in each language beyond its name: its kinds, in the same order as `variants`
 * (the household's names, else the catalog's; a kind with neither keeps its own name).
 */
export function variantsTranslations(
  item: string,
  variants: readonly string[],
  own?: KindNames | null,
): Translations {
  if (!variants.length) return {};
  const out: Translations = {};
  for (const locale of LOCALES) {
    const names = variants.map((v) => kindName(item, v, locale, own) ?? v);
    if (names.some((name, index) => name !== variants[index])) out[locale] = { variants: names };
  }
  return out;
}

/** One kind of an item, as a `variant` field per language. */
export function variantTranslations(
  item: string,
  variant: string | null | undefined,
  own?: KindNames | null,
): Translations {
  if (!variant) return {};
  const out: Translations = {};
  for (const locale of LOCALES) {
    const name = kindName(item, variant, locale, own);
    if (name) out[locale] = { variant: name };
  }
  return out;
}

/** Joins translations field by field (later ones win), dropping empty entries. */
export function combine(...parts: Array<Translations | null | undefined>): Translations {
  const out: Translations = {};
  for (const part of parts) {
    if (!part) continue;
    for (const locale of LOCALES) {
      const entry = part[locale];
      if (entry) out[locale] = { ...(out[locale] ?? {}), ...entry };
    }
  }
  return cleanTranslations(out);
}

/** Only some fields of translations (a product's `name`, for a line that shows its name). */
export function onlyFields(
  value: Translations | null | undefined,
  fields: string[],
  rename: Record<string, string> = {},
): Translations {
  const out: Translations = {};
  for (const locale of LOCALES) {
    const entry = value?.[locale];
    if (!entry) continue;
    const kept: Record<string, string | string[]> = {};
    for (const field of fields) {
      const item = entry[field];
      if (item !== undefined) kept[rename[field] ?? field] = item;
    }
    if (Object.keys(kept).length) out[locale] = kept;
  }
  return out;
}

/** A text field per language (falls back to null when the record has none in that language). */
export function fieldIn(
  value: Translations | null | undefined,
  field: string,
  locale: Locale,
): string | null {
  const item = value?.[locale]?.[field];
  return typeof item === 'string' && item ? item : null;
}
