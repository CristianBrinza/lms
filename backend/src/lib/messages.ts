import type { Locale } from './i18n';

/**
 * The API's own words (errors and validation messages) in Romanian and Russian. The code throws
 * and validates in English; `translateMessage` turns the English into the person's language when
 * the answer is written (app.ts, onError). A message that isn't here stays English.
 *
 * Messages with names or numbers in them are matched by the patterns below the dictionary.
 */

type Pair = { ro: string; ru: string };

export const MESSAGES: Record<string, Pair> = {
  // ------------------------------------------------------------ the API itself
  'Not found': { ro: 'Nu a fost găsit', ru: 'Не найдено' },
  'Something went wrong': { ro: 'Ceva n-a mers', ru: 'Что-то пошло не так' },
  'Too many attempts. Try again in a few minutes.': {
    ro: 'Prea multe încercări. Încearcă din nou peste câteva minute.',
    ru: 'Слишком много попыток. Попробуйте снова через несколько минут.',
  },
  'The request body must be JSON': {
    ro: 'Cererea trebuie să fie în format JSON',
    ru: 'Тело запроса должно быть в формате JSON',
  },
  'Some fields need attention': {
    ro: 'Unele câmpuri trebuie corectate',
    ru: 'Некоторые поля нужно исправить',
  },
  'Unknown host': { ro: 'Gazdă necunoscută', ru: 'Неизвестный хост' },
  'Cross-site request rejected': {
    ro: 'Cererea de pe alt site a fost respinsă',
    ru: 'Запрос с другого сайта отклонён',
  },
  'Origin not allowed': { ro: 'Sursa cererii nu e permisă', ru: 'Источник запроса не разрешён' },
  'Content-Type must be application/json': {
    ro: 'Content-Type trebuie să fie application/json',
    ru: 'Content-Type должен быть application/json',
  },
  'Request body too large': { ro: 'Cererea e prea mare', ru: 'Слишком большой запрос' },
  Required: { ro: 'Obligatoriu', ru: 'Обязательное поле' },
  'Nothing to change': { ro: 'Nu e nimic de schimbat', ru: 'Нечего менять' },

  // ------------------------------------------------------------ signing in, sessions, keys
  'Enter your email': { ro: 'Introdu e-mailul', ru: 'Введите электронную почту' },
  'Enter your password': { ro: 'Introdu parola', ru: 'Введите пароль' },
  'That email and password do not match': {
    ro: 'E-mailul și parola nu se potrivesc',
    ru: 'Почта и пароль не совпадают',
  },
  'Access keys can’t sign in or out': {
    ro: 'Cheile de acces nu pot intra sau ieși din cont',
    ru: 'Ключи доступа не могут входить в аккаунт и выходить из него',
  },
  'This account is switched off. Ask the admin to turn it back on.': {
    ro: 'Contul e dezactivat. Roagă administratorul să-l pornească din nou.',
    ru: 'Этот аккаунт отключён. Попросите администратора снова его включить.',
  },
  'Session was refreshed by another tab': {
    ro: 'Sesiunea a fost reînnoită în altă filă',
    ru: 'Сеанс обновлён в другой вкладке',
  },
  'Your session has ended. Sign in again.': {
    ro: 'Sesiunea ta s-a încheiat. Intră din nou în cont.',
    ru: 'Ваш сеанс завершён. Войдите снова.',
  },
  'Sign in to continue': { ro: 'Intră în cont ca să continui', ru: 'Войдите, чтобы продолжить' },
  'Access token expired or invalid': {
    ro: 'Sesiunea a expirat sau nu e validă',
    ru: 'Сеанс истёк или недействителен',
  },
  'This session has ended': { ro: 'Sesiunea s-a încheiat', ru: 'Этот сеанс завершён' },
  'Do this in the app, signed in': {
    ro: 'Fă asta în aplicație, după ce intri în cont',
    ru: 'Сделайте это в приложении, войдя в аккаунт',
  },
  'You do not have access to this': { ro: 'Nu ai acces la asta', ru: 'У вас нет доступа к этому' },
  'This access key is not valid': {
    ro: 'Cheia de acces nu e validă',
    ru: 'Этот ключ доступа недействителен',
  },
  'This access key can’t do that': {
    ro: 'Cheia de acces nu are voie să facă asta',
    ru: 'Этому ключу доступа это не разрешено',
  },
  'Sign in to LMS, or use an access key (Settings → Claude access)': {
    ro: 'Intră în LMS sau folosește o cheie de acces (Setări → Acces Claude)',
    ru: 'Войдите в LMS или используйте ключ доступа (Настройки → Доступ Claude)',
  },
  'Request failed': { ro: 'Cererea n-a reușit', ru: 'Запрос не выполнен' },
  'Remove an old key first': {
    ro: 'Șterge mai întâi o cheie veche',
    ru: 'Сначала удалите старый ключ',
  },
  'This assistant isn’t registered': {
    ro: 'Acest asistent nu e înregistrat',
    ru: 'Этот ассистент не зарегистрирован',
  },
  'That return address isn’t this assistant’s': {
    ro: 'Adresa de întoarcere nu e a acestui asistent',
    ru: 'Этот адрес возврата не принадлежит ассистенту',
  },
  'Only admins can give an assistant admin access': {
    ro: 'Doar administratorii pot da unui asistent acces de administrator',
    ru: 'Только администраторы могут дать ассистенту права администратора',
  },

  // ------------------------------------------------------------ profile, password, devices
  'Email is too long': { ro: 'E-mailul e prea lung', ru: 'Слишком длинный адрес почты' },
  'Enter a valid email address': {
    ro: 'Introdu o adresă de e-mail validă',
    ru: 'Введите правильный адрес почты',
  },
  'Name is required': { ro: 'Scrie numele', ru: 'Укажите имя' },
  'Name is too long': { ro: 'Numele e prea lung', ru: 'Слишком длинное имя' },
  'Surname is too long': { ro: 'Numele de familie e prea lung', ru: 'Слишком длинная фамилия' },
  'Use at least 10 characters': {
    ro: 'Folosește cel puțin 10 caractere',
    ru: 'Используйте не меньше 10 символов',
  },
  'Use at most 200 characters': {
    ro: 'Folosește cel mult 200 de caractere',
    ru: 'Используйте не больше 200 символов',
  },
  'Use at least 10 characters that are not spaces': {
    ro: 'Folosește cel puțin 10 caractere care nu sunt spații',
    ru: 'Используйте не меньше 10 символов, не считая пробелов',
  },
  'Enter your current password': { ro: 'Introdu parola actuală', ru: 'Введите текущий пароль' },
  'Your current password is not right': {
    ro: 'Parola actuală nu e corectă',
    ru: 'Текущий пароль неверный',
  },
  'This is not your current password': {
    ro: 'Aceasta nu e parola ta actuală',
    ru: 'Это не ваш текущий пароль',
  },
  'Choose a password you have not used here': {
    ro: 'Alege o parolă pe care n-ai mai folosit-o aici',
    ru: 'Выберите пароль, который вы здесь ещё не использовали',
  },
  'This is the password you have now': {
    ro: 'Aceasta e parola pe care o ai acum',
    ru: 'Это ваш нынешний пароль',
  },
  'Device not found': { ro: 'Dispozitivul nu a fost găsit', ru: 'Устройство не найдено' },
  'Use “Sign out” to end this device’s session': {
    ro: 'Folosește „Ieși din cont” ca să închei sesiunea de pe acest dispozitiv',
    ru: 'Чтобы завершить сеанс на этом устройстве, нажмите «Выйти»',
  },
  'Key not found': { ro: 'Cheia nu a fost găsită', ru: 'Ключ не найден' },
  'Keep the name under 60 characters': {
    ro: 'Numele trebuie să aibă sub 60 de caractere',
    ru: 'Название должно быть короче 60 символов',
  },
  'Name the key, e.g. “Claude on my Mac”': {
    ro: 'Dă-i cheii un nume, de exemplu „Claude pe Mac”',
    ru: 'Назовите ключ, например «Claude на Mac»',
  },
  'Pick what the assistant may do': {
    ro: 'Alege ce poate face asistentul',
    ru: 'Выберите, что может делать ассистент',
  },
  'Not a real birth date': { ro: 'Data nașterii nu există', ru: 'Такой даты рождения нет' },
  'Use a date like 1990-05-31': {
    ro: 'Scrie data așa: 1990-05-31',
    ru: 'Укажите дату в виде 1990-05-31',
  },
  'Pick a day from 1 to 31': { ro: 'Alege o zi de la 1 la 31', ru: 'Выберите день от 1 до 31' },
  'Height in cm': { ro: 'Înălțimea, în cm', ru: 'Рост в см' },
  'Weight in kg': { ro: 'Greutatea, în kg', ru: 'Вес в кг' },
  'That picture is too large': { ro: 'Poza e prea mare', ru: 'Фото слишком большое' },
  'Use a JPEG, PNG or WebP picture': {
    ro: 'Folosește o poză JPEG, PNG sau WebP',
    ru: 'Используйте фото в формате JPEG, PNG или WebP',
  },
  'Not a picture': { ro: 'Nu e o poză', ru: 'Это не фото' },
  'Too large': { ro: 'Prea mare', ru: 'Слишком большое' },
  'That file isn’t the picture it says it is': {
    ro: 'Fișierul nu e o poză de tipul pe care îl arată',
    ru: 'Файл не совпадает с указанным типом фото',
  },
  'No picture': { ro: 'Nu e nicio poză', ru: 'Фото нет' },

  // ------------------------------------------------------------ drinks: cellar and tastings
  'That drink isn’t in your cellar': {
    ro: 'Băutura asta nu e în colecția ta',
    ru: 'Этого напитка нет в вашей коллекции',
  },
  'That tasting isn’t in the journal': {
    ro: 'Degustarea asta nu e în jurnal',
    ru: 'Этой дегустации нет в журнале',
  },
  'Say which drink': { ro: 'Spune ce băutură e', ru: 'Укажите напиток' },
  'Pick what kind of drink it is': { ro: 'Alege ce fel de băutură e', ru: 'Выберите вид напитка' },
  'A country code like MD, FR or US': {
    ro: 'Un cod de țară, ca MD, FR sau US',
    ru: 'Код страны, например MD, FR или US',
  },
  'A currency like MDL, EUR or USD': {
    ro: 'O monedă, ca MDL, EUR sau USD',
    ru: 'Валюта, например MDL, EUR или USD',
  },
  'Pick people from your household': {
    ro: 'Alege oameni din casa ta',
    ru: 'Выберите людей из вашей семьи',
  },
  'Not in your household': { ro: 'Nu e din casa ta', ru: 'Не из вашей семьи' },
  'That tasting sheet doesn’t fit this drink': {
    ro: 'Fișa de degustare nu se potrivește cu băutura',
    ru: 'Этот лист дегустации не подходит к напитку',
  },
  'Only the person who tasted it can change this': {
    ro: 'Doar cine a degustat poate schimba asta',
    ru: 'Изменить это может только тот, кто дегустировал',
  },
  'Use a JPEG, PNG, WebP or HEIC photo': {
    ro: 'Folosește o poză JPEG, PNG, WebP sau HEIC',
    ru: 'Используйте фото в формате JPEG, PNG, WebP или HEIC',
  },
  'That photo is too large': { ro: 'Poza e prea mare', ru: 'Фото слишком большое' },
  'That photo couldn’t be read': {
    ro: 'Poza nu a putut fi citită',
    ru: 'Не удалось прочитать фото',
  },

  // ------------------------------------------------------------ admin: people and kitchens
  'Choose member or admin': {
    ro: 'Alege: membru sau administrator',
    ru: 'Выберите: участник или администратор',
  },
  'Not a valid kitchen': { ro: 'Bucătăria nu e validă', ru: 'Такой кухни нет' },
  'Someone already uses this email': {
    ro: 'Cineva folosește deja acest e-mail',
    ru: 'Этот адрес почты уже кто-то использует',
  },
  'Keep at least one active admin, or nobody can manage accounts': {
    ro: 'Păstrează cel puțin un administrator activ, altfel nimeni nu va putea gestiona conturile',
    ru: 'Оставьте хотя бы одного активного администратора, иначе некому будет управлять аккаунтами',
  },
  'This person was not found': { ro: 'Persoana nu a fost găsită', ru: 'Этот человек не найден' },
  'You cannot switch off your own account': {
    ro: 'Nu-ți poți dezactiva propriul cont',
    ru: 'Нельзя отключить собственный аккаунт',
  },
  'That kitchen was not found': { ro: 'Bucătăria nu a fost găsită', ru: 'Эта кухня не найдена' },
  'Change your own password from your profile': {
    ro: 'Parola ta o schimbi din profil',
    ru: 'Свой пароль меняйте в профиле',
  },
  'Manage your own devices from Settings': {
    ro: 'Dispozitivele tale le gestionezi din Setări',
    ru: 'Своими устройствами управляйте в настройках',
  },
  'You cannot delete your own account': {
    ro: 'Nu-ți poți șterge propriul cont',
    ru: 'Нельзя удалить собственный аккаунт',
  },

  // ------------------------------------------------------------ food: items, stock, stores
  'Not a valid id': { ro: 'Identificator greșit', ru: 'Неверный идентификатор' },
  'Not a real date': { ro: 'Data asta nu există', ru: 'Такой даты нет' },
  'Use a date like 2026-10-31': {
    ro: 'Scrie data așa: 2026-10-31',
    ru: 'Укажите дату в виде 2026-10-31',
  },
  'Use a time like 18:30': { ro: 'Scrie ora așa: 18:30', ru: 'Укажите время в виде 18:30' },
  'Give it a name': { ro: 'Dă-i un nume', ru: 'Дайте название' },
  'Name it': { ro: 'Dă-i un nume', ru: 'Дайте название' },
  'Keep the name under 80 characters': {
    ro: 'Numele trebuie să aibă sub 80 de caractere',
    ru: 'Название должно быть короче 80 символов',
  },
  'Keep the name under 120 characters': {
    ro: 'Numele trebuie să aibă sub 120 de caractere',
    ru: 'Название должно быть короче 120 символов',
  },
  'Keep the note under 500 characters': {
    ro: 'Nota trebuie să aibă sub 500 de caractere',
    ru: 'Заметка должна быть короче 500 символов',
  },
  'Keep the note short': { ro: 'Scrie o notă mai scurtă', ru: 'Сделайте заметку короче' },
  'Keep it under 40 characters': {
    ro: 'Trebuie să aibă sub 40 de caractere',
    ru: 'Должно быть короче 40 символов',
  },
  'That amount is too large': { ro: 'Cantitatea e prea mare', ru: 'Слишком большое количество' },
  'Enter an amount above zero': {
    ro: 'Introdu o cantitate mai mare decât zero',
    ru: 'Введите количество больше нуля',
  },
  'That unit name is too long': {
    ro: 'Numele unității e prea lung',
    ru: 'Слишком длинное название единицы',
  },
  'Pick a unit': { ro: 'Alege o unitate', ru: 'Выберите единицу' },
  'Count it in pcs, g or ml': { ro: 'Numără în buc., g sau ml', ru: 'Считайте в шт., г или мл' },
  'Fridge, freezer, pantry or other': {
    ro: 'Frigider, congelator, cămară sau altceva',
    ru: 'Холодильник, морозилка, кладовая или другое',
  },
  'Pick a category': { ro: 'Alege o categorie', ru: 'Выберите категорию' },
  'Pick an icon from the set': {
    ro: 'Alege o pictogramă din set',
    ru: 'Выберите значок из набора',
  },
  // the kitchen's own icons
  'Icon not found': { ro: 'Pictograma nu a fost găsită', ru: 'Значок не найден' },
  'This kitchen has no such icon; create it first': {
    ro: 'Bucătăria nu are această pictogramă; creeaz-o mai întâi',
    ru: 'В этой кухне нет такого значка; сначала создайте его',
  },
  'Send the drawing as svg or as shapes': {
    ro: 'Trimite desenul ca svg sau ca forme',
    ru: 'Отправьте рисунок как svg или как фигуры',
  },
  'Send svg or shapes': { ro: 'Trimite svg sau forme', ru: 'Отправьте svg или фигуры' },
  'Icon keys look like custom:toast-bread': {
    ro: 'Cheile pictogramelor arată așa: custom:toast-bread',
    ru: 'Ключ значка выглядит так: custom:toast-bread',
  },
  'Keep the icon key under 64 characters': {
    ro: 'Cheia pictogramei trebuie să aibă sub 64 de caractere',
    ru: 'Ключ значка должен быть короче 64 символов',
  },
  'Keep the drawing under 20 KB': {
    ro: 'Desenul trebuie să aibă sub 20 KB',
    ru: 'Рисунок должен быть меньше 20 КБ',
  },
  'That price is too large': { ro: 'Prețul e prea mare', ru: 'Слишком высокая цена' },
  'Price can’t be negative': {
    ro: 'Prețul nu poate fi negativ',
    ru: 'Цена не может быть отрицательной',
  },
  'Full, low or out': {
    ro: 'Plin, pe terminate sau terminat',
    ru: 'Полно, мало или закончилось',
  },
  'Say how much': { ro: 'Spune cât', ru: 'Укажите, сколько' },
  'Say which item': { ro: 'Spune ce produs', ru: 'Укажите, какой продукт' },
  'Say which food': { ro: 'Spune ce aliment', ru: 'Укажите, какой продукт' },
  'Say which': { ro: 'Spune care', ru: 'Укажите, что именно' },
  'Item not found': { ro: 'Produsul nu a fost găsit', ru: 'Продукт не найден' },
  'You already have this item': { ro: 'Ai deja acest produs', ru: 'Этот продукт у вас уже есть' },
  'Another item has this name': {
    ro: 'Alt produs are deja acest nume',
    ru: 'Это название уже у другого продукта',
  },
  'A piece of this item is measured in its own unit': {
    ro: 'O bucată din acest produs se măsoară în unitatea lui',
    ru: 'Штука этого продукта измеряется в его собственной единице',
  },
  'Use up or remove its stock before changing how it is counted': {
    ro: 'Consumă sau scoate stocul înainte să schimbi cum se numără',
    ru: 'Сначала израсходуйте или уберите запасы, потом меняйте способ учёта',
  },
  'It still has stock': { ro: 'Mai are stoc', ru: 'Запасы ещё есть' },
  'Unknown place': { ro: 'Loc necunoscut', ru: 'Неизвестное место' },
  'That store is not in your kitchen': {
    ro: 'Magazinul ăsta nu e în bucătăria ta',
    ru: 'Этого магазина нет в вашей кухне',
  },
  'Unknown store': { ro: 'Magazin necunoscut', ru: 'Неизвестный магазин' },
  'Store not found': { ro: 'Magazinul nu a fost găsit', ru: 'Магазин не найден' },
  'You already have this store': { ro: 'Ai deja acest magazin', ru: 'Этот магазин у вас уже есть' },
  'Name the store': { ro: 'Scrie numele magazinului', ru: 'Укажите название магазина' },
  'That piece is not in your kitchen': {
    ro: 'Bucata asta nu e în bucătăria ta',
    ru: 'Этой упаковки нет в вашей кухне',
  },
  'That piece belongs to another item': {
    ro: 'Bucata asta e a altui produs',
    ru: 'Эта упаковка относится к другому продукту',
  },
  'Wrong item': { ro: 'Alt produs', ru: 'Не тот продукт' },
  'That piece is used up': { ro: 'Bucata asta s-a terminat', ru: 'Эта упаковка закончилась' },
  'There isn’t that much in it': { ro: 'Nu e atât de mult în ea', ru: 'Там столько нет' },
  'Pour into another piece of the same item': {
    ro: 'Toarnă în altă bucată din același produs',
    ru: 'Переливайте в другую упаковку того же продукта',
  },
  'Wrong piece': { ro: 'Bucată greșită', ru: 'Не та упаковка' },
  'That piece is not this ingredient': {
    ro: 'Bucata aleasă nu e a acestui ingredient',
    ru: 'Выбранная упаковка не относится к этому ингредиенту',
  },
  'That is not in your kitchenware': {
    ro: 'Asta nu e printre vasele tale',
    ru: 'Этого нет среди вашей посуды',
  },

  // ------------------------------------------------------------ food: people, recipes, meals
  'That person isn’t in this kitchen': {
    ro: 'Persoana asta nu e în această bucătărie',
    ru: 'Этого человека нет в этой кухне',
  },
  'Unknown person': { ro: 'Persoană necunoscută', ru: 'Неизвестный человек' },
  'Recipe not found': { ro: 'Rețeta nu a fost găsită', ru: 'Рецепт не найден' },
  'Give the recipe a name': { ro: 'Dă-i rețetei un nume', ru: 'Дайте рецепту название' },
  'Use a full link (https://…)': {
    ro: 'Folosește un link complet (https://…)',
    ru: 'Укажите полную ссылку (https://…)',
  },
  'At most 60 ingredients': { ro: 'Cel mult 60 de ingrediente', ru: 'Не больше 60 ингредиентов' },
  'Breakfast, lunch, dinner or snack': {
    ro: 'Mic dejun, prânz, cină sau gustare',
    ru: 'Завтрак, обед, ужин или перекус',
  },
  'Pick a recipe or name it': {
    ro: 'Alege o rețetă sau scrie un nume',
    ru: 'Выберите рецепт или дайте название',
  },
  'Pick a recipe or name the meal': {
    ro: 'Alege o rețetă sau scrie numele mesei',
    ru: 'Выберите рецепт или назовите приём пищи',
  },
  '“from” must be before “to”': {
    ro: '„De la” trebuie să fie înainte de „până la”',
    ru: '«С» должно быть раньше, чем «по»',
  },
  'Meal not found': { ro: 'Masa nu a fost găsită', ru: 'Приём пищи не найден' },
  'This meal was eaten at home; reopen it first': {
    ro: 'Masa asta a fost mâncată acasă; redeschide-o mai întâi',
    ru: 'Этот приём пищи был дома; сначала откройте его снова',
  },
  'This meal is done; reopen it to change it': {
    ro: 'Masa asta e gata; redeschide-o ca s-o schimbi',
    ru: 'Этот приём пищи завершён; откройте его снова, чтобы изменить',
  },
  'This meal is already done': { ro: 'Masa asta e deja gata', ru: 'Этот приём пищи уже завершён' },
  'This meal is not marked done': {
    ro: 'Masa asta nu e marcată ca gata',
    ru: 'Этот приём пищи не отмечен как завершённый',
  },
  'That part is not in this meal': {
    ro: 'Partea asta nu e în această masă',
    ru: 'Этой части нет в этом приёме пищи',
  },
  'Unknown part': { ro: 'Parte necunoscută', ru: 'Неизвестная часть' },
  'That line is not in this meal': {
    ro: 'Rândul ăsta nu e în această masă',
    ru: 'Этой строки нет в этом приёме пищи',
  },
  'That line has no such option': {
    ro: 'Rândul ăsta nu are o astfel de variantă',
    ru: 'У этой строки нет такого варианта',
  },
  'No such option': { ro: 'Nu există o astfel de variantă', ru: 'Такого варианта нет' },

  // ------------------------------------------------------------ food: shopping
  'Say what to buy': { ro: 'Spune ce trebuie cumpărat', ru: 'Укажите, что купить' },
  'At most 100 at once': { ro: 'Cel mult 100 deodată', ru: 'Не больше 100 за раз' },
  'Add at least one item': {
    ro: 'Adaugă cel puțin un produs',
    ru: 'Добавьте хотя бы один продукт',
  },
  'Say which lines': { ro: 'Spune care rânduri', ru: 'Укажите, какие строки' },
  'That line is not on your lists': {
    ro: 'Rândul ăsta nu e pe listele tale',
    ru: 'Этой строки нет в ваших списках',
  },
  'That line was already checked out; edit it in the trip': {
    ro: 'Rândul ăsta e deja achitat; modifică-l în cumpărătura respectivă',
    ru: 'Эта строка уже оплачена; измените её в той покупке',
  },
  'That line was already checked out': {
    ro: 'Rândul ăsta e deja achitat',
    ru: 'Эта строка уже оплачена',
  },
  'Tick what you bought first': {
    ro: 'Bifează mai întâi ce ai cumpărat',
    ru: 'Сначала отметьте, что вы купили',
  },
  'A line is not in this cart': {
    ro: 'Un rând nu e în acest coș',
    ru: 'Одной из строк нет в этой корзине',
  },
  'Unknown line': { ro: 'Rând necunoscut', ru: 'Неизвестная строка' },
  'Trip not found': { ro: 'Cumpărătura nu a fost găsită', ru: 'Покупка не найдена' },
  'That line is not in this trip': {
    ro: 'Rândul ăsta nu e în această cumpărătură',
    ru: 'Этой строки нет в этой покупке',
  },

  // ------------------------------------------------------------ reminders
  'Pick at least one day': { ro: 'Alege cel puțin o zi', ru: 'Выберите хотя бы один день' },
  'Pick a time': { ro: 'Alege ora', ru: 'Выберите время' },
  'Reminder not found': { ro: 'Mementoul nu a fost găsit', ru: 'Напоминание не найдено' },
  'Reminders aren’t set up on the server yet': {
    ro: 'Mementourile nu sunt încă configurate pe server',
    ru: 'Напоминания на сервере ещё не настроены',
  },
  'No phone has reminders turned on yet': {
    ro: 'Niciun telefon nu are încă mementourile pornite',
    ru: 'Ещё ни на одном телефоне не включены напоминания',
  },

  // ------------------------------------------------------------ training
  'Out of range': { ro: 'În afara limitelor', ru: 'Вне допустимых пределов' },
  'That day hasn’t come yet': { ro: 'Ziua asta n-a venit încă', ru: 'Этот день ещё не наступил' },
  'In the future': { ro: 'În viitor', ru: 'В будущем' },
  'Equipment not found': { ro: 'Echipamentul nu a fost găsit', ru: 'Инвентарь не найден' },
  'Exercise not found': { ro: 'Exercițiul nu a fost găsit', ru: 'Упражнение не найдено' },
  'Unknown exercise': { ro: 'Exercițiu necunoscut', ru: 'Неизвестное упражнение' },
  'That exercise is in someone else’s library': {
    ro: 'Exercițiul ăsta e în biblioteca altcuiva',
    ru: 'Это упражнение из чужой библиотеки',
  },
  'Not theirs': { ro: 'Nu e al acestei persoane', ru: 'Не этого человека' },
  'That weight is too heavy': { ro: 'Greutatea e prea mare', ru: 'Слишком большой вес' },
  'A weight can’t be negative': {
    ro: 'Greutatea nu poate fi negativă',
    ru: 'Вес не может быть отрицательным',
  },
  'Add an exercise': { ro: 'Adaugă un exercițiu', ru: 'Добавьте упражнение' },
  'Say how many, how long or how far': {
    ro: 'Spune câte, cât timp sau ce distanță',
    ru: 'Укажите, сколько раз, как долго или какое расстояние',
  },
  'That person isn’t in this household': {
    ro: 'Persoana asta nu e din această familie',
    ru: 'Этого человека нет в этой семье',
  },
  'Set not found': { ro: 'Seria nu a fost găsită', ru: 'Подход не найден' },
  'That workout was skipped; plan it again first': {
    ro: 'Antrenamentul ăsta a fost sărit; planifică-l din nou mai întâi',
    ru: 'Эта тренировка пропущена; сначала запланируйте её снова',
  },
  'That time hasn’t come yet': { ro: 'Ora asta n-a venit încă', ru: 'Это время ещё не наступило' },
  'Routine not found': { ro: 'Programul nu a fost găsit', ru: 'Программа не найдена' },
  'Unknown routine': { ro: 'Program necunoscut', ru: 'Неизвестная программа' },
  'Workout not found': { ro: 'Antrenamentul nu a fost găsit', ru: 'Тренировка не найдена' },
  'That workout is done; plan it again first': {
    ro: 'Antrenamentul ăsta e gata; planifică-l din nou mai întâi',
    ru: 'Эта тренировка завершена; сначала запланируйте её снова',
  },
  'That workout is already done': {
    ro: 'Antrenamentul ăsta e deja gata',
    ru: 'Эта тренировка уже завершена',
  },
  'Log at least one set first, or skip the workout': {
    ro: 'Notează mai întâi cel puțin o serie sau sari peste antrenament',
    ru: 'Сначала запишите хотя бы один подход или пропустите тренировку',
  },

  // ------------------------------------------------------------ travel
  'A time like 07:30': { ro: 'O oră ca 07:30', ru: 'Время в виде 07:30' },
  'A currency like MDL or EUR': {
    ro: 'O monedă ca MDL sau EUR',
    ru: 'Валюта, например MDL или EUR',
  },
  'The trip ends before it starts': {
    ro: 'Călătoria se termină înainte să înceapă',
    ru: 'Поездка заканчивается раньше, чем начинается',
  },
  'Before the start': { ro: 'Înainte de început', ru: 'Раньше начала' },
  'Name the trip': { ro: 'Dă-i călătoriei un nume', ru: 'Назовите поездку' },
  'No such trip': { ro: 'Nu există o astfel de călătorie', ru: 'Такой поездки нет' },
  'No such bag': { ro: 'Nu există o astfel de geantă', ru: 'Такой сумки нет' },
  'No such gear': { ro: 'Nu există un astfel de accesoriu', ru: 'Такой техники нет' },
  'No such item on the packing list': {
    ro: 'Nu există un astfel de lucru pe lista de bagaj',
    ru: 'Такой вещи нет в списке для сборов',
  },
  'No such item on this trip': {
    ro: 'Nu există un astfel de lucru în această călătorie',
    ru: 'Такой вещи нет в этой поездке',
  },
  'Someone there isn’t in this household': {
    ro: 'Cineva de acolo nu e din această familie',
    ru: 'Кого-то из них нет в этой семье',
  },
  'That bag isn’t yours': { ro: 'Geanta asta nu e a voastră', ru: 'Это не ваша сумка' },
  'Unknown bag': { ro: 'Geantă necunoscută', ru: 'Неизвестная сумка' },
  'That gear isn’t yours': { ro: 'Accesoriul ăsta nu e al vostru', ru: 'Это не ваша техника' },
  'Unknown gear': { ro: 'Accesoriu necunoscut', ru: 'Неизвестная техника' },

  // ------------------------------------------------------------ watching
  'Watching needs its TMDB key': {
    ro: 'Filmele și serialele au nevoie de cheia TMDB',
    ru: 'Для кино и сериалов нужен ключ TMDB',
  },
  'TMDB isn’t answering right now. Try again in a moment.': {
    ro: 'TMDB nu răspunde acum. Încearcă din nou peste puțin.',
    ru: 'TMDB сейчас не отвечает. Попробуйте чуть позже.',
  },
  'That isn’t on TMDB': { ro: 'Asta nu e pe TMDB', ru: 'Этого нет на TMDB' },
  'Use a title id like movie:603 or tv:1399': {
    ro: 'Folosește un id ca movie:603 sau tv:1399',
    ru: 'Используйте id вида movie:603 или tv:1399',
  },
  'That date is in the future': { ro: 'Data asta e în viitor', ru: 'Эта дата в будущем' },
  'A film has no episodes': { ro: 'Un film nu are episoade', ru: 'У фильма нет серий' },
  'Say which episode': { ro: 'Spune care episod', ru: 'Укажите серию' },
  'That play isn’t there': { ro: 'Vizionarea asta nu există', ru: 'Такого просмотра нет' },
  'That list isn’t there': { ro: 'Lista asta nu există', ru: 'Такого списка нет' },
  'Only who made the list can change who sees it': {
    ro: 'Doar cine a făcut lista poate schimba cine o vede',
    ru: 'Только автор списка может менять, кто его видит',
  },
  'Only who made the list can delete it': {
    ro: 'Doar cine a făcut lista o poate șterge',
    ru: 'Удалить список может только его автор',
  },
  'That file can’t be read': { ro: 'Fișierul ăsta nu poate fi citit', ru: 'Этот файл не читается' },
  'At most 120 days from the start': {
    ro: 'Cel mult 120 de zile de la început',
    ru: 'Не больше 120 дней от начала',
  },
  'The start is after the end': { ro: 'Începutul e după sfârșit', ru: 'Начало позже конца' },
};

// ---------------------------------------------------------------- words inside the patterns

/** Units as people read them; custom piece units ("jar", "slice") are the household's own words. */
const UNITS: Record<string, Pair> = {
  pcs: { ro: 'buc.', ru: 'шт.' },
  g: { ro: 'g', ru: 'г' },
  kg: { ro: 'kg', ru: 'кг' },
  ml: { ro: 'ml', ru: 'мл' },
  l: { ro: 'l', ru: 'л' },
  tsp: { ro: 'lingurițe', ru: 'ч. л.' },
  tbsp: { ro: 'linguri', ru: 'ст. л.' },
  cup: { ro: 'căni', ru: 'стак.' },
};
const unit = (value: string, locale: 'ro' | 'ru') => UNITS[value]?.[locale] ?? value;

/** Health readings (training/health.ts HEALTH_KINDS). */
const HEALTH: Record<string, Pair> = {
  steps: { ro: 'Pași', ru: 'Шаги' },
  distance: { ro: 'Distanță', ru: 'Расстояние' },
  activeEnergy: { ro: 'Energie activă', ru: 'Активная энергия' },
  restingEnergy: { ro: 'Energie în repaus', ru: 'Энергия покоя' },
  dietaryEnergy: { ro: 'Energie din mâncare', ru: 'Энергия из еды' },
  exerciseMinutes: { ro: 'Minute de antrenament', ru: 'Минуты тренировки' },
  flights: { ro: 'Etaje', ru: 'Этажи' },
  restingHeartRate: { ro: 'Puls în repaus', ru: 'Пульс в покое' },
  heartRate: { ro: 'Puls', ru: 'Пульс' },
  hrv: { ro: 'Variabilitatea pulsului', ru: 'Вариабельность пульса' },
  sleep: { ro: 'Somn', ru: 'Сон' },
  weight: { ro: 'Greutate', ru: 'Вес' },
  bodyFat: { ro: 'Grăsime corporală', ru: 'Процент жира' },
  vo2max: { ro: 'VO2 max', ru: 'VO2 max' },
};

/** "1 caracter, 2 caractere, 20 de caractere"; "1 символа, 5 символов" (after "не больше"). */
function count(n: number, locale: 'ro' | 'ru', forms: { one: string; few: string; other: string }) {
  const rule = new Intl.PluralRules(locale).select(n);
  if (locale === 'ro')
    return `${n} ${rule === 'one' ? forms.one : rule === 'few' ? forms.few : `de ${forms.other}`}`;
  return `${n} ${rule === 'one' ? forms.one : forms.other}`;
}

const sizeWord = (thing: string, n: number, locale: 'ro' | 'ru') => {
  const chars = /character/.test(thing);
  if (locale === 'ro')
    return chars
      ? count(n, 'ro', { one: 'caracter', few: 'caractere', other: 'caractere' })
      : count(n, 'ro', { one: 'element', few: 'elemente', other: 'elemente' });
  return chars
    ? count(n, 'ru', { one: 'символа', few: 'символов', other: 'символов' })
    : count(n, 'ru', { one: 'элемента', few: 'элементов', other: 'элементов' });
};

type Pattern = { match: RegExp; ro: (m: string[]) => string; ru: (m: string[]) => string };

/** Messages with names, amounts or limits in them. The first that matches wins. */
export const PATTERNS: Pattern[] = [
  // food: the kitchen's own icons (the reason stays as written: it names SVG parts)
  {
    match: /^This drawing can’t be used: (.+)$/,
    ro: (m) => `Desenul nu poate fi folosit: ${m[1]}`,
    ru: (m) => `Этот рисунок нельзя использовать: ${m[1]}`,
  },
  // food: items and stock
  {
    match: /^(.+) is already in your kitchen$/,
    ro: (m) => `${m[1]} e deja în bucătăria ta`,
    ru: (m) => `${m[1]} уже есть в вашей кухне`,
  },
  {
    match: /^(.+) is already a store$/,
    ro: (m) => `${m[1]} e deja printre magazine`,
    ru: (m) => `${m[1]} уже есть среди магазинов`,
  },
  {
    match: /^(.+) is counted in amounts; change it to “full \/ low \/ out” first$/,
    ro: (m) =>
      `${m[1]} se numără în cantități; schimbă-l mai întâi pe „plin / pe terminate / terminat”`,
    ru: (m) =>
      `${m[1]} учитывается количеством; сначала переключите на «полно / мало / закончилось»`,
  },
  {
    match: /^This item is counted in (\S+); (.+) can’t be converted( without a piece size)?$/,
    ro: (m) =>
      `Acest produs se numără în ${unit(m[1]!, 'ro')}; ${unit(m[2]!, 'ro')} nu se poate converti${m[3] ? ' fără mărimea unei bucăți' : ''}`,
    ru: (m) =>
      `Этот продукт учитывается в ${unit(m[1]!, 'ru')}; ${unit(m[2]!, 'ru')} не пересчитать${m[3] ? ' без размера штуки' : ''}`,
  },
  {
    match: /^(.+) is counted in (\S+); (.+) can’t be converted$/,
    ro: (m) =>
      `${m[1]} se numără în ${unit(m[2]!, 'ro')}; ${unit(m[3]!, 'ro')} nu se poate converti`,
    ru: (m) => `${m[1]} учитывается в ${unit(m[2]!, 'ru')}; ${unit(m[3]!, 'ru')} не пересчитать`,
  },
  {
    match: /^At most ([\d.]+) (\S+)$/,
    ro: (m) => `Cel mult ${m[1]} ${unit(m[2]!, 'ro')}`,
    ru: (m) => `Не больше ${m[1]} ${unit(m[2]!, 'ru')}`,
  },
  {
    match: /^Use (pcs|g|ml|kg|l|tsp|tbsp|cup)$/,
    ro: (m) => `Folosește ${unit(m[1]!, 'ro')}`,
    ru: (m) => `Используйте ${unit(m[1]!, 'ru')}`,
  },
  {
    match: /^Not enough (.+) for what you picked$/,
    ro: (m) => `Nu ajunge ce ai ales: ${m[1]}`,
    ru: (m) => `Не хватает выбранного: ${m[1]}`,
  },
  {
    match: /^Already used or opened: (.+)\. Correct those lines instead\.$/,
    ro: (m) => `Deja folosite sau deschise: ${m[1]}. Corectează mai bine acele rânduri.`,
    ru: (m) => `Уже использовано или открыто: ${m[1]}. Лучше исправьте эти строки.`,
  },
  // training: health readings
  {
    match: /^(\w+) (-?[\d.]+) isn’t believable$/,
    ro: (m) => `${HEALTH[m[1]!]?.ro ?? m[1]}: ${m[2]} nu pare o valoare reală`,
    ru: (m) => `${HEALTH[m[1]!]?.ru ?? m[1]}: ${m[2]} — неправдоподобное значение`,
  },
  // validation fields made from a label (lib/validation.ts nameField)
  {
    match: /^(.+) is required$/,
    ro: (m) => `Completează: ${m[1]}`,
    ru: (m) => `Заполните: ${m[1]}`,
  },
  {
    match: /^(.+) is too long$/,
    ro: (m) => `Prea lung: ${m[1]}`,
    ru: (m) => `Слишком длинно: ${m[1]}`,
  },

  // zod's own English, for schemas that don't give a message
  {
    match: /^Invalid input: expected \w+, received undefined$/,
    ro: () => 'Obligatoriu',
    ru: () => 'Обязательное поле',
  },
  {
    match: /^Invalid input: expected int, received number$/,
    ro: () => 'Folosește un număr întreg',
    ru: () => 'Используйте целое число',
  },
  {
    match: /^Invalid input: expected \w+, received \w+$/,
    ro: () => 'Valoarea nu are tipul potrivit',
    ru: () => 'Значение неверного типа',
  },
  {
    match: /^Invalid option: expected one of .+$/,
    ro: () => 'Alege una dintre variantele permise',
    ru: () => 'Выберите один из допустимых вариантов',
  },
  {
    match: /^Too big: expected \w+ to have <=?(\d+) (\w+)$/,
    ro: (m) => `Cel mult ${sizeWord(m[2]!, Number(m[1]), 'ro')}`,
    ru: (m) => `Не больше ${sizeWord(m[2]!, Number(m[1]), 'ru')}`,
  },
  {
    match: /^Too small: expected \w+ to have >=?(\d+) (\w+)$/,
    ro: (m) =>
      m[1] === '1' && /character/.test(m[2]!)
        ? 'Obligatoriu'
        : `Cel puțin ${sizeWord(m[2]!, Number(m[1]), 'ro')}`,
    ru: (m) =>
      m[1] === '1' && /character/.test(m[2]!)
        ? 'Обязательное поле'
        : `Не меньше ${sizeWord(m[2]!, Number(m[1]), 'ru')}`,
  },
  {
    match: /^Too (?:big|small): expected \w+ to have exactly (\d+) (\w+)$/,
    ro: (m) => `Exact ${sizeWord(m[2]!, Number(m[1]), 'ro')}`,
    ru: (m) => {
      const n = Number(m[1]);
      const [one, few, many] = /character/.test(m[2]!)
        ? ['символ', 'символа', 'символов']
        : ['элемент', 'элемента', 'элементов'];
      const rule = new Intl.PluralRules('ru').select(n);
      return `Ровно ${n} ${rule === 'one' ? one : rule === 'few' ? few : many}`;
    },
  },
  {
    match: /^Too big: expected \w+ to be <(=?)(-?[\d.e+]+)$/,
    ro: (m) => (m[1] ? `Cel mult ${m[2]}` : `Mai puțin de ${m[2]}`),
    ru: (m) => (m[1] ? `Не больше ${m[2]}` : `Меньше ${m[2]}`),
  },
  {
    match: /^Too small: expected \w+ to be >(=?)(-?[\d.e+]+)$/,
    ro: (m) => (m[1] ? `Cel puțin ${m[2]}` : `Mai mult de ${m[2]}`),
    ru: (m) => (m[1] ? `Не меньше ${m[2]}` : `Больше ${m[2]}`),
  },
  {
    match: /^Invalid email address$/,
    ro: () => 'Adresă de e-mail greșită',
    ru: () => 'Неверный адрес почты',
  },
  { match: /^Invalid URL$/, ro: () => 'Link greșit', ru: () => 'Неверная ссылка' },
  { match: /^Invalid UUID$/, ro: () => 'Identificator greșit', ru: () => 'Неверный идентификатор' },
  {
    match: /^Invalid number: must be a multiple of ([\d.]+)$/,
    ro: (m) => `Trebuie să fie multiplu de ${m[1]}`,
    ru: (m) => `Должно быть кратно ${m[1]}`,
  },
  {
    match: /^Unrecognized keys?: .+$/,
    ro: () => 'Câmpuri necunoscute',
    ru: () => 'Неизвестные поля',
  },
  {
    match: /^Invalid (?:input|value)\b.*$/,
    ro: () => 'Valoarea nu e potrivită',
    ru: () => 'Недопустимое значение',
  },
  {
    match: /^Invalid (?:string|ISO \w+|[\w ]+)(?:: .*)?$/,
    ro: () => 'Formatul nu e potrivit',
    ru: () => 'Неверный формат',
  },
];

/** The English message in the given language; unknown messages come back as they are. */
export function translateMessage(message: string, locale: Locale): string {
  if (locale === 'en' || !message) return message;
  const known = MESSAGES[message];
  if (known) return known[locale];
  for (const pattern of PATTERNS) {
    const m = pattern.match.exec(message);
    if (m) return pattern[locale]([...m].map((part) => part ?? ''));
  }
  return message;
}

/** Each field's message in the given language. */
export function translateFields(
  fields: Record<string, string> | undefined,
  locale: Locale,
): Record<string, string> | undefined {
  if (!fields || locale === 'en') return fields;
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [
      key,
      typeof value === 'string' ? translateMessage(value, locale) : value,
    ]),
  );
}
