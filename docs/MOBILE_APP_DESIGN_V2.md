# Hanab Mobile — Design Specification v2

**Статус:** рекомендуемая финальная спецификация перед реализацией.  
**Основа:** первый design architecture pass и зафиксированные решения этого refinement-прохода.

V2 заменяет предыдущие предложения о четвёртой browsing-вкладке, поведении обычного Android Back из Live и визуальной форме Return. Остальные изменения уточняют выбранную архитектуру, а не открывают её заново.

Ниже «должен» означает требование к будущей реализации. Размеры — проектные параметры и проверяемые ограничения, **не утверждение о пройденной физической валидации**. Возможности runtime рассматриваются относительно уже изученных snapshots, без предположений о более новых изменениях.

Неизменяемая основа: один authoritative room/game runtime, server-authoritative состояние, stable `card.order`, отсутствие queue/retry/replay игровых команд, изоляция review от live sends и сохранение established C17 interaction semantics.

---

## 1. Revised app-level IA

### Два независимых измерения состояния

**Room ownership отвечает на вопрос «в какой комнате я участвую». Presentation focus — «какую поверхность приложения я сейчас рассматриваю».**

Переход в browsing меняет второе, но не первое.

```text
BROWSING
├── Home
│   ├── Table details
│   ├── Create Table                 — отдельная task
│   ├── Open game link
│   └── Lobby chat
│
├── History
│   ├── My history / Friends / Tagged
│   ├── Game details
│   ├── Other Scores
│   └── Open replay / JSON import    — отдельная task
│
├── People
│   ├── People directory
│   ├── Messages — this client/session
│   ├── User / Profile
│   └── Conversation
│
└── More
    ├── Account identity → My Profile
    ├── Settings
    │   ├── Account & security
    │   ├── Appearance
    │   ├── Cards
    │   └── Gameplay presentation
    ├── Tools
    └── About / version

FOCUSED ROOM WORKSPACE
├── Pregame
├── Live
│   └── Rewind
├── Finished / Replay / Shared review
└── Hypothetical

ROOM-OWNED CHILD SURFACES
├── Table chat
├── Table / Game / Review menu
├── Participants / User details
├── Settings-from-room
└── Inspectors / editors / confirmations
```

User/Profile, Settings и Conversation — переиспользуемые поверхности. Их **источник открытия определяет navigation owner**, а не создаёт вторую разновидность экрана.

Например, Settings из browsing More возвращается в More. Settings из Game menu возвращается в room-контекст, не переключает вкладку More и не показывает bottom navigation.

### Единственная комната

Пока текущая room остаётся attended, можно просматривать разрешённые History, People, Messages, More и Home. Но **просмотреть запись History и открыть другой replay-runtime — разные действия**.

Проверенный runtime уже различает эти категории: чтение истории не требует свободной room, тогда как создание replay, join и spectate проверяют её освобождение. 

| Намерение | Поведение v2 |
|---|---|
| Перейти между browsing-разделами | Только смена presentation focus |
| Открыть Profile, Conversation, Settings | Текущая room сохраняется |
| Вернуться в текущую room | Локальный переход, без повторного Join/Reattend |
| Открыть собственный Rewind | Использовать существующий workspace |
| Открыть другую room/replay при занятом runtime | Не переключать автоматически; показать ограничение и необходимые явные действия |
| Прекратить наблюдение и открыть другой стол | Допустима явно подтверждённая последовательность; новая room открывается только после завершения предыдущего attendance transition |
| Потерять соединение посередине переключения | Не продолжать отложенную цепочку автоматически после reconnect |

Наличие reattendable собственной игры в Lobby — отдельный случай. Это не доказательство, что room уже attended. Действие для неё обозначается как **`Rejoin game`**, а не маскируется под локальный Return.

---

## 2. Final browsing shell

### Основная навигация

**Home · History · People · More**

У каждого раздела независимый локальный stack. Переключение сохраняет фильтры, scroll position и безопасное состояние текущей задачи в пределах авторизованной клиентской сессии.

Повторное нажатие активной вкладки:

1. возвращает в корень её stack;
2. если пользователь уже в корне — прокручивает список наверх.

Re-tap не выполняет Create, Leave, Unattend, Send или другие команды с побочными эффектами.

### Где присутствует глобальная навигация

| Поверхность | Portrait | Short-wide landscape |
|---|---|---|
| Корни Home / History / People / More | Bottom navigation | Navigation rail |
| Обычные browsing details, Profile, категории Settings | Bottom navigation | Rail |
| Conversation без IME | Bottom navigation | Rail |
| Conversation с IME | Навигация скрывается; место получает composer | Rail скрывается на время focused typing |
| Create, import, password-change task | Глобальной навигации нет | Глобальной навигации нет |
| Любой focused Room Workspace | **Нет** | **Нет** |
| Chat, Settings, Profile, открытые как room-owned child | **Нет** | **Нет** |

Скрытие navigation в Create или password task не превращает их в room. Это полноценные локальные задачи со своим Back и origin.

### Общая геометрия browsing

Рекомендуемый Return встроен в закреплённый app bar; подробное сравнение вариантов — в разделе 5.

```text
PORTRAIT BROWSING

┌──────────────────────────────────────┐
│ SYSTEM STATUS / CUTOUT                │
├──────────────────────────────────────┤
│ F  Screen title       [Room Return]   │
├──────────────────────────────────────┤
│ F  Screen toolbar / filters           │
├──────────────────────────────────────┤
│                                      │
│ S  Screen content                    │
│                                      │
├──────────────────────────────────────┤
│ F  Home | History | People | More     │
├──────────────────────────────────────┤
│ SYSTEM NAVIGATION / SAFE INSET        │
└──────────────────────────────────────┘
```

Здесь и далее: **F** — закреплённая область, **S** — прокручиваемая, **O** — временная поверхность. Системные области показаны отдельно и не включаются повторно во внутренние отступы.

App bar, экранный toolbar и navigation имеют разных владельцев. Длинный список не должен уносить Return за пределы экрана.

---

## 3. Browsing More и game-context overflow

### Финальное наименование

**`More` остаётся названием только browsing destination.**

Внутри комнаты используется кнопка **`Menu`** с контекстным заголовком:

| Контекст | Заголовок открытой поверхности |
|---|---|
| Pregame | `Table menu` |
| Live и собственный Rewind | `Game menu` |
| Finished replay / shared review / Hypothetical | `Review menu` |

На тесной панели допустима иконка overflow вместо видимого слова `Menu`, но accessible label остаётся полным: `Open game menu`, `Open table menu` или `Open review menu`.

### Рассмотренные альтернативы

| Вариант | Оценка |
|---|---|
| `More` в browsing и `More` в игре | Отклонён: одинаковое имя скрывает разных владельцев и разный набор действий |
| `More` + `Table/Game/Review menu` | **Выбран:** browsing-раздел не меняет имя, room-контекст обозначается явно |
| `More` + `Actions` | Понятно для команд, но хуже подходит для participants, perspective и settings |
| `More` + `Room` | Коротко, но недостаточно ясно, что это меню |

### Разделение содержимого

**Browsing More:** профиль, настройки, безопасность аккаунта, инструменты общего назначения, About.

**Room menu:** параметры и участники текущего стола, доступные pause/perspective/administration actions, tags/export, контекстный вход в Settings, явные attendance-команды.

В browsing More не появляются Start, Switch role, Pause, Unattend, Kick или управление shared-review leader. Постоянный Return в общем app bar — часть shell, а не пункт More.

---

## 4. Revised Android Back contract

### Основное решение

**Обычный player Live: Back consumed. Обычный player Pregame: также consumed. Browsing открывается явной кнопкой `Browse`.**

Для Pregame это предпочтительнее прежнего перехода по Back: состав и параметры могут меняться, запуск может начаться в любой момент, а одинаковое поведение до и после Start устраняет неожиданную смену значения системного жеста.

Для spectator в обычных Pregame/Live предлагается та же политика. **Authoritative semantics не требуют делать Unattend по Back.** Старое различие player/spectator было navigation policy, а не обязательством сервера. Поэтому специальное spectator-исключение не вводится.  

### Приоритет обработки

Back обрабатывает ближайший активный контекст. Нижележащий Game не должен получить тот же Back повторно.

| Состояние | Результат одного Back | Что не происходит |
|---|---|---|
| Открыт confirmation dialog | Cancel / dismissal | Подтверждаемая команда не отправляется |
| Открыт Note editor | Отмена несохранённого draft и выход из editor одним действием | Нет Save; не остаётся промежуточного editor без клавиатуры |
| Chat/Conversation с IME | Скрыть IME | Не закрывать одновременно разговор, не отправлять сообщение |
| Chat без IME | Закрыть Chat / вернуться к origin | Не менять attendance |
| Room menu | Закрыть menu | Не открывать browsing More |
| Вложенная поверхность menu | Вернуться на один уровень | Не закрывать всю цепочку неожиданно |
| Settings-from-room | Назад по его локальному stack | Не переходить в browsing Settings/More |
| Открыт discard/resource/participant inspector | Закрыть inspector | Не изменять underlying task |
| Clue Composer | Закрыть composer, очистить target/candidate/preview | Не Give clue |
| Выбрана карта / есть action arming | Снять selection/arming | Не Play/Discard |
| Открыт локальный read-tool | Закрыть tool | Не выходить из room |
| Собственный Rewind, верхних слоёв нет | Return to Live с disarm | Не выполнить live action |
| Обычный player Live, слоёв нет | **Consume** | Не Browse, не Leave/Unattend |
| Обычный player Pregame, слоёв нет | **Consume** | Не Browse, не Leave |
| Spectator Pregame/Live, слоёв нет | **Consume** | Не Stop watching |
| Dedicated replay / finished review | Вернуться в browsing origin, сохранив attended review | Не Close review |
| Hypothetical, локальных инструментов нет | Вернуться в browsing origin, сохранив hypothetical context | Не End hypothetical за других участников |
| Bootstrap / незавершённый атомарный room transition | Consume; сохранять progress/error recovery surface | Не локально «отменять» уже отправленную серверную операцию |
| Browsing nested screen | Pop внутри текущего раздела | Не Return to game |
| Корень History / People / More | Перейти в Home | Не менять room |
| Корень Home | Передать системе | Не отправлять явный Unattend |
| Create root | Вернуться в Home | Не `tableCreate` |
| Вложенная Create subtask | Вернуться в Create; неприменённые изменения subtask отменить | Не Create |
| Password-change task | Вернуться к Settings и очистить секретные поля | Не отправлять смену пароля |

Специальное поведение Note editor сохраняет established C17 transaction: Back отменяет draft, Save — отдельное действие. 

### Дополнительные правила

В bare Live/Pregame Back не открывает диалог «Выйти?», не требует двойного нажатия и не запускает скрытый exit flow. Кнопка Browse остаётся видимой.

Начало и отмена системного Back gesture не выполняют команд. Предпросмотр перехода должен соответствовать реальному результату: bare Live не должен показывать будущий Home, если финальное действие будет consumed.

Действия `Leave table`, `Unattend`, `Stop watching`, `Close review` остаются явными. Их подтверждение объясняет конкретное последствие. Unattend player не следует называть завершением партии.

---

## 5. Active-room Return: три концепта и рекомендация

### Контрольный профиль сравнения

Для арифметики используется **условное доступное окно 412 × 840 dp после системных insets**, font scale 1.0. Это расчётный A55-class профиль, не замер конкретного Galaxy A55.

Общий browsing app bar: минимум 56 dp. Bottom navigation: номинально 64 dp. Экранные filters/toolbars учитываются отдельно и одинаково для сравниваемых вариантов.

### A. Full-width mini-bar над bottom navigation

```text
│ S  Content                           │
├──────────────────────────────────────┤
│ F  YOUR TURN · Game #123     [Return] │
├──────────────────────────────────────┤
│ F  Home | History | People | More    │
```

Сильные стороны: заметная отдельная область, широкая touch target, положение рядом с основной навигацией. Слабое место — постоянный расход высоты даже в спокойном review-состоянии.

### B. Compact persistent chip / floating affordance

```text
│ S  Content                           │
│                    ┌───────────────┐ │
│                    │ YOUR TURN     │ │
│                    │ Return        │ │
│                    └───────────────┘ │
├──────────────────────────────────────┤
│ F  Home | History | People | More    │
```

Компактнее визуально, но требует либо перекрывать контент, либо резервировать пространство, которое уничтожает часть выигрыша. Положение chip также конфликтует с composer, action footer и экранными floating actions.

### C. Room-aware app bar

```text
├──────────────────────────────────────┤
│ F  History          ┌───────────────┐│
│                     │ YOUR TURN     ││
│                     │ Return to game││
│                     └───────────────┘│
├──────────────────────────────────────┤
│ F  My history | Friends | Tagged    │
│ S  Content                           │
```

Return занимает стабильный action slot в закреплённом header. Это **не уведомление**, не toast и не отдельная скрываемая плашка.

При нехватке ширины header честно становится двухрядным:

```text
│ F  < Account & security              │
├──────────────────────────────────────┤
│ F  YOUR TURN             Return to game│
```

### Сравнение

| Критерий | A: mini-bar | B: floating chip | C: room-aware app bar |
|---|---|---|---|
| Добавочная высота на контрольном portrait | Обычно 48–64 dp; 48 dp — около 5,7% доступной высоты | Формально 0, но перекрывается зона порядка высоты chip и отступа | Обычно 0 на коротких root headers; при stacking добавляется полноценная строка |
| YOUR TURN | Очень заметно | Заметно при достаточном размере, но может восприниматься как временное уведомление | Заметный state/action block на постоянном месте |
| Finished/review | Отдельная полоса может выглядеть избыточно | Компактно, но слабее различается с live | Спокойное состояние в том же slot |
| Font scaling | Хорошо переносит рост, увеличивает высоту | Быстро перестаёт быть «компактным» | Требует обязательного stacking; не должен сжимать title |
| Discoverability | Высокая | Ниже: floating affordance легче принять за необязательный элемент | Высокая при постоянном текстовом action |
| Связь с bottom navigation | Образует понятный нижний navigation cluster | Риск визуального конфликта с выбранной вкладкой | Независим от нижней навигации |
| Short-wide browsing | Нужно переносить полосу вверх или терять дополнительную высоту | Перекрывает дефицитную область списка | Встраивается в уже необходимый горизонтальный header |
| Риск перекрытия контента | Низкий при layout reservation | Высокий без reservation | Нулевой: header участвует в layout |
| Главный компромисс | Высота | Надёжность и доступность | Верхнее положение и более высокий header на длинных nested screens |

### Рекомендация: C

**Использовать room-aware app bar. A оставить документированной альтернативой; B не выбирать для v2.**

C выигрывает на наиболее частых browsing roots и в short-wide landscape. При этом экономия не должна достигаться скрытым переносом действий: Create, Open replay и filters изначально принадлежат экранным toolbars, независимо от наличия room.

### Обязательный контракт C

Return — один целый control с touch target не менее 48 dp по высоте. У него текст действия и краткий статус. Он не сворачивается до одной цветной точки.

Header измеряет title, Back и Return совместно. Если они не помещаются с нормальным чтением title, Return переносится на отдельную строку. Ellipsis в критическом action label и вертикальная «полоса» из букв недопустимы.

Размер slot резервируется для ожидаемых состояний текущей room, чтобы появление YOUR TURN не дёргало список.

| Room state | Состояние Return |
|---|---|
| Pregame | `Return to table`; кратко роль/заполненность |
| Live, ход другого | `LIVE · Tn` + `Return to game` |
| Live, наш ход | `YOUR TURN` + `Return to game` |
| Пользователь ушёл в browsing из собственного Rewind | `Return to Live`; переход явно возвращает актуальное состояние и disarms |
| Finished | `Finished · score` + `Review game` |
| Dedicated replay/shared review | `REPLAY` или `SHARED REVIEW` + `Return to review` |
| Hypothetical | Явный `HYPOTHETICAL` + действие возврата в этот контекст |
| Reconnecting | `Reconnecting` + Return к безопасной room surface; без устаревшего YOUR TURN |
| Room отсутствует | Control отсутствует |

Возврат из browsing в собственную ongoing game не должен неожиданно открывать старое Rewind-состояние под подписью `Return to game`. Именно поэтому в этом случае используется явный `Return to Live`.

Сохранённый note draft не удаляется и не сохраняется автоматически при Return. Он остаётся recoverable task по исходному `card.order`; немедленное открытие клавиатуры не является частью Return.

На разрешённых browsing task screens Return остаётся в header даже без bottom navigation. На app-owned overlays он не должен требовать предварительно пройти цепочку из нескольких Close. Неподтверждённый dialog при таком возврате отменяется. Системные permission/share surfaces находятся за пределами этого app-shell контракта.

---

## 6. Home и отдельный Create flow

### 6.1 Home — portrait

```text
┌────────────────────────────────────────┐
│ SYSTEM STATUS                          │
├────────────────────────────────────────┤
│ F  Home                 [Room Return]  │
│ F  [Create]              [Open link]    │
├────────────────────────────────────────┤
│ S  Pregame                             │
│    Table name                          │
│    Variant · 3/5 · Friend here [Join]   │
│    ─────────────────────────────────   │
│    Private table                       │
│    Variant · 2/4             [Details] │
│                                        │
│    Running                             │
│    Table · Variant           [Spectate]│
│                                        │
│    Shared replays                      │
│    Game · Variant             [Review] │
│                                        │
│    Lobby chat (3)                    > │
├────────────────────────────────────────┤
│ F  Home | History | People | More      │
├────────────────────────────────────────┤
│ SYSTEM NAVIGATION                      │
└────────────────────────────────────────┘
```

На первом экране должны быть реальные table rows. Create — primary toolbar action, Join — primary action подходящей строки. Open link, Spectate, Review и Lobby chat вторичны.

Scroll принадлежит каталогу. Никакой формы Create внутри него нет.

Сохраняется существующий guard для собственной reattendable running game: Home не предлагает начать второй стол. При занятой room создание также не выглядит доступным. Это состояние объясняется коротким текстом, а не появлением ложной активной кнопки.

Собственная **уже attended** room представлена общим Return. Собственная **не attended, но reattendable** игра — отдельной Home row с `Rejoin game`. Эти элементы не дублируются как два равнозначных способа возврата.

### 6.2 Home — landscape

```text
┌───────────────────────────────────────────────────────────────┐
│ SYSTEM STATUS / SIDE CUTOUT INSETS                             │
├──────────┬────────────────────────────────────────────────────┤
│ F Home   │ F Home                           [Room Return]     │
│ History  │ F [Create]                         [Open link]     │
│ People   ├────────────────────────────────────────────────────┤
│ More     │ S Pregame                                          │
│          │   Table · Variant · 3/5 · Friend          [Join]    │
│          │   Private table · Variant              [Details]   │
│          │   ──────────────────────────────────────────────   │
│          │   Running / Shared replays                         │
│          │   Table · Variant                     [Spectate]   │
│          │   Lobby chat (3)                                >  │
├──────────┴────────────────────────────────────────────────────┤
│ SYSTEM NAVIGATION                                             │
└───────────────────────────────────────────────────────────────┘
```

Landscape меняет строку стола: copy и action используют ширину, уменьшая высоту. **Вторая колонка с постоянно открытым Create не появляется.**

Rail и header закреплены; список прокручивается. Если enlarged text делает строку слишком высокой, action переносится под copy, а не сжимает название.

### 6.3 Create — структура задачи

Порядок основного пути:

**Variant → Max players → common options → name/access → Advanced → Create.**

`Max players` остаётся прямым выбором **2 3 4 5 6**.

| Возможность | Где находится |
|---|---|
| Variant | Contextual searchable picker |
| Timed и обычные параметры времени | Основная форма; timer fields раскрываются при Timed |
| Table name / private access | Основная форма, компактная группа |
| Bots | Строка внутри Advanced → contextual multi-select picker |
| Specific seed | Nested task внутри Advanced |
| Редкие rules | Nested `Additional rules` task |
| Specific-seed prefill из History | Активная настройка явно показана в основном Create summary, поскольку пользователь уже выбрал этот путь |

Bots picker не держит список ботов постоянно раскрытым. На коротком окне он становится full-height picker, а не низким sheet.

### Create — portrait

```text
┌──────────────────────────────────────┐
│ SYSTEM STATUS                        │
├──────────────────────────────────────┤
│ F  < Create Table                    │
├──────────────────────────────────────┤
│ S  Variant                         > │
│                                      │
│    Max players                       │
│    [2] [3] [4] [5] [6]              │
│                                      │
│    Timed                       [Off] │
│    Common options                    │
│                                      │
│    Table name                        │
│    [Optional / server default      ] │
│    Access                 [Public >] │
│                                      │
│    Advanced                        > │
│    Selected extras summary           │
├──────────────────────────────────────┤
│ F  [Create Table]                     │
├──────────────────────────────────────┤
│ SYSTEM NAVIGATION — NO GLOBAL TABS    │
└──────────────────────────────────────┘
```

### Create — landscape

```text
┌───────────────────────────────────────────────────────────────┐
│ SYSTEM STATUS / SAFE INSETS                                    │
├───────────────────────────────────────────────────────────────┤
│ F  < Create Table                                             │
├──────────────────────────────────┬────────────────────────────┤
│ S  Variant                     > │ F  Current draft summary   │
│    Max players [2][3][4][5][6]   │    Variant · 4 players     │
│    Timed / timer fields          │    Untimed · Public        │
│    Table name / access           │                            │
│    Advanced                    > │    [Create Table]          │
├──────────────────────────────────┴────────────────────────────┤
│ SYSTEM NAVIGATION — NO GLOBAL NAVIGATION                       │
└───────────────────────────────────────────────────────────────┘
```

Две области используются только при fit основной формы и summary. Иначе landscape остаётся широким task screen с одним scroll и закреплённым action footer. При IME summary уступает место вводу.

### Transaction rules

Изменения формы — draft. Финальный `Create Table` остаётся отдельным явным действием.

Back из корня возвращает в Home и не отправляет `tableCreate`. Непарольные draft values допустимо сохранить в памяти текущей сессии. Пароль очищается при завершении/отмене Create task и не попадает в persistence, diagnostics или navigation state.

Переход к picker внутри той же task не должен терять основной draft. Nested task использует Apply; её Back отменяет только неприменённое вложенное изменение.

Server-backed preferences и latent timer values сохраняют существующий смысл. Specific seed продолжает использовать существующий canonical prefill и серверное построение seed; выбор max players не выдаётся за гарантию фактического состава будущей игры.  

---

## 7. Pregame specification

### Информационная иерархия

Пользователь сразу видит: **стол, вариант, свою роль, leader, заполненность и primary action**.

Полная статистика игроков, bot tools и spectators не предшествуют Start.

### Portrait

```text
┌────────────────────────────────────────┐
│ SYSTEM STATUS                          │
├────────────────────────────────────────┤
│ F [Browse] Table #123 [Chat 2] [Menu]   │
│ F Table name                           │
│ F No Variant · Untimed · 3/5            │
│ F You: Player · Leader                 │
├────────────────────────────────────────┤
│ S You                        Leader    │
│   Alice                      Present > │
│   Bob                        Present > │
│   2 open seats                         │
│   ──────────────────────────────────   │
│   Table settings                     > │
│   Spectators 2                       > │
│   Team tools                         > │
├────────────────────────────────────────┤
│ F [Role]                  [Start game] │
├────────────────────────────────────────┤
│ SYSTEM NAVIGATION — NO GLOBAL TABS      │
└────────────────────────────────────────┘
```

### Landscape

```text
┌────────────────────────────────────────────────────────────────┐
│ SYSTEM STATUS / SAFE INSETS                                     │
├────────────────────────────────────────────────────────────────┤
│ F [Browse] Table #123                            [Chat] [Menu]  │
├────────────────────────────────┬───────────────────────────────┤
│ F Table name · You: Leader      │ F No Variant · Untimed · 3/5  │
│ S You                 Leader   │ S Table settings            > │
│   Alice               Present >│   Spectators 2              > │
│   Bob                 Present >│   Team tools                > │
│   2 open seats                 │   Proposal, when received   > │
├────────────────────────────────┴───────────────────────────────┤
│ F [Role]                                         [Start game] │
├────────────────────────────────────────────────────────────────┤
│ SYSTEM NAVIGATION — NO GLOBAL NAVIGATION                        │
└────────────────────────────────────────────────────────────────┘
```

Landscape делит roster и setup summary, а не растягивает последовательность portrait panels.

### Роли и действия

| Роль | Primary footer | Вторичные действия |
|---|---|---|
| Leader/player | `Start game` по existing eligibility | Role, Table settings, participants actions |
| Player, не leader | `Waiting for leader` | Role; предложения настроек через существующий flow |
| Spectator | `Join as player`, когда допустимо | Наблюдение, participants, Chat |
| Любая роль при pending transition | Pending state соответствующего действия | Конфликтующие controls недоступны |

`Leave table` / `Stop watching` находятся в **Table menu**, отдельно от Start. Это пересмотр предыдущего wireframe с Leave в primary footer: редкая команда участия больше не занимает постоянное место рядом со Start.

Не вводится новый Ready/voting protocol. Start использует актуальный authoritative roster и existing guards.

Изменения не-owner обозначаются как **proposal**, а не как уже изменённые options. Apply proposal использует существующее server-backed поведение.  

Если Start произошёл, пока пользователь уже browsing, Return меняется на game-state. Это не повод перехватывать focus или уничтожать открытый Conversation draft.

---

## 8. Live portrait specification

### Постоянные области

```text
┌────────────────────────────────────────┐
│ SYSTEM STATUS                          │
├────────────────────────────────────────┤
│ F [Browse] Game #123 [Chat 2] [Menu]    │
│ F LIVE T41 · YOUR TURN                  │
├────────────────────────────────────────┤
│ F Score/Max · Clues · Strikes · Deck    │
│ F Pace · Eff                           │
│ F Fireworks       Discards summary     │
│ F Last action…              [Recent]   │
├────────────────────────────────────────┤
│                                        │
│ F Alice       [ ][ ][ ][ ]             │
│ F Bob         [ ][ ][ ][ ]             │
│ F …remaining opponents…                │
│                                        │
│ F YOU         [?][?][?][?]              │
├────────────────────────────────────────┤
│ F WORKBENCH — reserved rectangle       │
│   Current tool / explicit target       │
│   [Play] [Discard] / clue controls     │
│   S only secondary detail overflow     │
├────────────────────────────────────────┤
│ SYSTEM NAVIGATION — NO GLOBAL TABS      │
└────────────────────────────────────────┘
```

Нарисованные строки HUD — информационные группы, не требование к отдельной высокой панели для каждой. Реальная композиция группируется по измеренной ширине и font scale.

**Первый экран:** mode, actor, ресурсы, все руки в сертифицированном layout envelope и Workbench. Основное действие — текущая C17 task. Scroll всего normal gameplay отсутствует.

### Иерархия информации

Score/Max, Clues, Strikes, Deck, Pace и значимый Eff/FRE остаются видимыми. Подробные объяснения метрик — в inspectors; значения и thresholds не меняются.

Fireworks и discard summary компактны. Last Action — короткий anchor, Recent — доступ к последовательности. Большая декоративная карточка Last Action не имеет права вытеснить руку.

Собственная/observed рука — устойчивый anchor рядом с Workbench. Порядок игроков не зависит от текущего actor.

### Workbench

Workbench резервируется для набора обычных задач текущего room envelope, а не для открытого в данный момент tool. Переключение Card → Clue → Note read → Rewind не меняет geometry Ledger.

Сохраняются C17 действия:

- own-card tap выбирает/инспектирует, отдельный Play/Discard отправляет;
- short tap другой руки открывает Clue только при соответствующей existing eligibility;
- long hold остаётся transient empathy;
- single/double-tap note semantics не переопределяются новой навигацией;
- вход в review disarms live actions.

Profile не открывается новым тапом по gameplay hand: это нарушило бы уже существующий gesture vocabulary. В Live User details доступны через participants/context surfaces.

### Browse и Return

Browse снимает unsafe selection/arming и закрывает видимый Clue Composer, то есть не оставляет скрытый clue plan. Recoverable note draft сохраняется по исходной карте.

После Return требуется новый deliberate action. Возврат, закрытие overlay и завершение reconnect сами по себе не подтверждают Play/Discard/Clue.

---

## 9. Live landscape: две композиции и измеримые fit rules

Текущие landscape screenshots остаются evidence против stretched portrait. Само наличие широкого окна не доказывает пригодность двух колонок: нужно учитывать и высоту, и содержание задачи.

### A. Ledger/table region + side Workbench

```text
┌──────────────────────────────────────────────────────────────────┐
│ SYSTEM STATUS / CUTOUT / SIDE NAVIGATION INSETS                   │
├──────────────────────────────────────────────────────────────────┤
│ F [Browse] #123 · LIVE T41 · YOUR TURN             [Chat] [Menu]  │
├──────────────────────────────────────┬───────────────────────────┤
│ F LEDGER                             │ F Score/Max · Clues       │
│                                      │   Strikes · Deck          │
│ Alice             Bob                │   Pace · Eff              │
│ [ ][ ][ ][ ]      [ ][ ][ ][ ]        │   Fireworks / Discards    │
│                                      │───────────────────────────│
│ Carol             Dan                │ F Last action… [Recent]   │
│ [ ][ ][ ][ ]      [ ][ ][ ][ ]        │───────────────────────────│
│                                      │ F WORKBENCH               │
│ Eve                                  │   Selected target         │
│ [ ][ ][ ][ ]                         │   Color / rank choices    │
│──────────────────────────────────────│   [Give clue]             │
│ YOU             [?][?][?][?]         │                           │
├──────────────────────────────────────┴───────────────────────────┤
│ SYSTEM NAVIGATION — NO GLOBAL NAVIGATION                          │
└──────────────────────────────────────────────────────────────────┘
```

Ledger использует одну или две колонки opponent hands по результату fit. Own/observed anchor занимает нижнюю полосу Ledger.

HUD, table summary, Last Action и Workbench расположены в dock справа. Только secondary details внутри dock могут прокручиваться. Candidate controls и commit action обычной задачи не уходят в скрытый scroll.

**Преимущество:** инструменты не отнимают высоту каждой руки.  
**Ограничение:** 5 opponent hands плюс own anchor могут не поместиться по высоте даже при достаточной ширине.

### B. Seating grid + horizontal Workbench

```text
┌──────────────────────────────────────────────────────────────────┐
│ SYSTEM STATUS / CUTOUT / SIDE NAVIGATION INSETS                   │
├──────────────────────────────────────────────────────────────────┤
│ F [Browse] #123 · LIVE T41 · YOUR TURN             [Chat] [Menu]  │
├──────────────────────────────────────────────────────────────────┤
│ F Resources · Fireworks · Discards · Last action / Recent         │
├─────────────────────┬─────────────────────┬──────────────────────┤
│ F Alice             │ F Bob               │ F Carol              │
│   [ ][ ][ ][ ]      │   [ ][ ][ ][ ]      │   [ ][ ][ ][ ]       │
├─────────────────────┼─────────────────────┼──────────────────────┤
│ F Dan               │ F Eve               │ F YOU                │
│   [ ][ ][ ][ ]      │   [ ][ ][ ][ ]      │   [?][?][?][?]       │
├─────────────────────┴─────────────────────┴──────────────────────┤
│ F WORKBENCH                                                      │
│   Candidate controls / card actions / timeline       [Confirm]   │
├──────────────────────────────────────────────────────────────────┤
│ SYSTEM NAVIGATION — NO GLOBAL NAVIGATION                          │
└──────────────────────────────────────────────────────────────────┘
```

Сетка использует две или три колонки. Порядок — deterministic seating order относительно anchor; own/observed hand находится в последней ячейке нижнего занятого ряда, рядом с Workbench.

Пустые ячейки не заполняются навигацией или нестабильными инструментами. Уменьшение количества карт в конце игры не перестраивает сетку.

**Преимущество:** меньше вертикальных рядов рук.  
**Ограничение:** уменьшается ширина отдельной hand cell; extra-card capacity может сделать B непригодной раньше, чем кажется по скриншоту.

### 9.1 Входные данные fit

Раскладка получает:

| Параметр | Правило |
|---|---|
| Available width/height | Реальная window geometry после safe-area/system-navigation insets |
| Player count | Authoritative metadata |
| Card capacity | Максимальная вместимость руки для текущих options, не текущее количество оставшихся карт |
| Font scale | Фактический системный масштаб |
| Card aspect ratio | Существующий renderer, без изменения artwork |
| Card readability floor | Не ниже согласованного baseline и результатов physical validation |
| Touch geometry | Непересекающиеся actionable regions |
| Workbench envelope | Максимум требований обычных tools, которые могут использоваться в этом room |
| Header/HUD geometry | Измеренные размеры с реальными labels, timers и mode states |

IME **не меняет выбранную базовую композицию A/B**. Клавиатурная задача получает отдельную overlay/task composition.

### 9.2 Горизонтальная проверка руки

Для capacity \(C\), высоты card face \(h\), отношения ширины к высоте \(r\), card gap \(g_c\):

\[
W_{\text{hand}} =
C \cdot \max(rh,\; W_{\text{touch}})
+ (C-1)g_c
+ P_{\text{hand}}
\]

Здесь \(W_{\text{touch}}\) — требуемая ширина независимой interactive области, а не обязательно ширина нарисованного лица.

Для индивидуально actionable cards базовая цель — 48 dp. Нельзя объявить её выполненной за счёт перекрывающихся hit slop.

Имя/роль игрока либо находятся над рукой, либо занимают отдельную измеренную lane. Их ширина не вычитается «на глаз».

### 9.3 Вертикальная проверка

Высота hand row включает label, card headroom, face/touch region и padding.

**Для A:**

\[
H_{\text{ledger}} =
\left\lceil\frac{P-1}{k}\right\rceil H_{\text{opponent-row}}
+ G_{\text{opponent-rows}}
+ G_{\text{anchor}}
+ H_{\text{own-row}}
\]

где \(k\) — одна или две колонки opponent hands.

Одновременно должны выполняться:

\[
W_{\text{ledger}} + G_{\text{dock}} + W_{\text{dock}} \le W
\]

\[
H_{\text{ledger}} \le H_{\text{body}}
\]

\[
H_{\text{HUD}} + H_{\text{LastAction}} +
H_{\text{Workbench-envelope}} \le H_{\text{body}}
\]

**Для B:**

Ширина каждой из двух/трёх колонок должна вместить соответствующую hand capacity.

\[
H_{\text{header}} + H_{\text{table-strip}} +
H_{\text{grid}} + H_{\text{horizontal-workbench}} +
G_{\text{regions}} \le H
\]

Высота grid row определяется самой высокой рукой в этом ряду, включая own anchor.

### 9.4 Workbench requirements

Резервируется **максимум**, а не сумма обычных task layouts:

| Task | Что обязано помещаться без скрытого основного действия |
|---|---|
| Card actions | Target identity, Play, Discard |
| Clue | Target, все предусмотренные color/rank choices, selected candidate, Give |
| Note read | Target, читаемая часть note, Edit; длинный текст может иметь внутренний scroll |
| Rewind/replay | Temporal position, Previous/Next, timeline и Live либо shared-follow action |
| Hypothetical | Явный mode и текущая обычная task; редкие morph/settings controls — в inspector/menu |

Для B color/rank choices могут идти рядом в одной широкой полосе. Для A они обычно располагаются несколькими рядами. Это измеряется на реальном наборе clue choices.

### 9.5 Числовой пример выбора

**Расчётный fixture, не аппаратный результат:** usable window 860 × 388 dp; 6 игроков; capacity 4; touch slot 48 dp; gap 4 dp; суммарные горизонтальные hand paddings 16 dp.

Минимальная ширина такой руки:

\[
4 \times 48 + 3 \times 4 + 16 = 220\text{ dp}
\]

Допустим, измеренные hand rows при выбранном renderer size составляют 80 dp для opponents и 88 dp для own hand.

В A при двух колонках нужны три opponent rows:

\[
3 \times 80 + 2 \times 8 + 8 + 88 = 352\text{ dp}
\]

При body height 324 dp **A не проходит**, хотя по ширине руки помещаются.

В B три колонки дают два ряда:

\[
80 + 88 + 8 = 176\text{ dp}
\]

При header 48, table strip 64, Workbench 64 и межобластных отступах 16:

\[
48 + 64 + 176 + 64 + 16 = 368\text{ dp}
\]

**B проходит геометрию этого fixture.** Остаются проверки реальной читабельности и tool content.

При трёх игроках в том же окне A может пройти с одной колонкой opponents и получает предпочтение за более прямую связь Ledger → side Workbench.

### 9.6 Финальная политика выбора

**A предпочтительна, если проходит все width/height/readability/touch/tool требования. B выбирается, когда A не проходит, а B проходит.**

Orientation только направляет окно в short-wide evaluation. Она не выбирает композицию самостоятельно.

Layout не переключается из-за нового хода, раскрытия Clue, изменения note, scrubbing или уменьшения руки. Пересчёт разрешён при изменении window/insets/font scale, authoritative player/capacity envelope или другого реального геометрического ограничения.

Текущий allocator содержит числовые floors и отдельный own-hand budget; их нельзя считать универсально доказанными readability limits. Новая оболочка не вправе понизить их просто для прохождения arithmetic fit. 

Если ни A, ни B не проходят на целевом обычном устройстве, это **layout blocker**, а не повод автоматически объявить tiny-card/summary режим нормальным 6P.

---

## 10. Chat и contextual Menu

### Table Chat

```text
PORTRAIT — ROOM-OWNED TASK

┌──────────────────────────────────────┐
│ SYSTEM STATUS                        │
├──────────────────────────────────────┤
│ F < Table chat #123   [Return to game]│
├──────────────────────────────────────┤
│ S Messages                           │
│   Reading position retained          │
│                           [New ↓]    │
├──────────────────────────────────────┤
│ F [Message…                  ] [Send]│
├──────────────────────────────────────┤
│ IME OR SYSTEM NAVIGATION             │
│ NO GLOBAL TABS                       │
└──────────────────────────────────────┘

LANDSCAPE

┌──────────────────────────────────────┬──────────────────────────┐
│ Stable Ledger remains underneath    │ O Table chat     [Return]│
│ No reflow when Chat opens           │ S Messages               │
│                                     │                          │
│                                     │ F Composer        [Send] │
└──────────────────────────────────────┴──────────────────────────┘
```

Landscape Chat занимает боковую overlay, если её собственные width/height requirements проходят. Иначе — full-window task. **Он не сжимает Ledger**, чтобы «влезть рядом».

При IME доступная область отдаётся Chat task; сохранение полного игрового поля над клавиатурой не является обязательным.

Messages scroll и composer разделены. Новые сообщения не прокручивают принудительно пользователя, читающего старую часть transcript.

### Read и routing

Room unread очищается только при фактической видимости актуального Chat, foreground/focus и достижении соответствующего read boundary. Просто оставшийся mounted component не считается прочтением.

Это важно при новом persistent shell: существующий `ChatPanel` содержит mount/message-driven read effects, которые нельзя переносить без visibility ownership. 

Displayed recipient/context должен совпадать с send route. Текущий общий `submit()` использует room-контекст runtime, поэтому **Lobby Chat composer нельзя без дополнительного routing contract активировать поверх attended Game**. В v2 Lobby Chat при attended room read-only; для отправки явно предлагается Table Chat. PM использует existing explicit-recipient path. 

### Contextual Menu

```text
┌──────────────────────────────────────┐
│ F Game menu                  [Close]│
├──────────────────────────────────────┤
│ S Participants / spectators        >│
│   Perspective, when eligible       >│
│   Pause / supported room controls   │
│   Tags / replay tools              >│
│   Settings                         >│
│   ────────────────────────────────  │
│   Unattend / Stop watching          │
└──────────────────────────────────────┘
```

Menu имеет измеренный непустой viewport. Header и Close не зависят от высоты внутреннего списка. В short-wide это боковая либо full-window поверхность, не низкий центральный Modal.

Chat, Browse и Return to Live не прячутся исключительно в Menu.

---

## 11. History / Review

### History — portrait

```text
┌────────────────────────────────────────┐
│ SYSTEM STATUS                          │
├────────────────────────────────────────┤
│ F History                [Room Return] │
│ F [Open replay]                        │
│ F My history | Friends | Tagged        │
│ F Exact tag field — only when relevant │
├────────────────────────────────────────┤
│ S 23/25 · Variant · 4P                  │
│   Players · Date             [Review] │
│   Details / actions                  > │
│   ──────────────────────────────────   │
│   25/25 · Variant · 3P                  │
│   Players · Date             [Review] │
├────────────────────────────────────────┤
│ F Home | History | People | More       │
├────────────────────────────────────────┤
│ SYSTEM NAVIGATION                      │
└────────────────────────────────────────┘
```

### History — landscape

```text
┌──────────┬─────────────────────────────────────────────────────┐
│ F Home   │ F History                         [Room Return]     │
│ History  │ F My | Friends | Tagged              [Open replay] │
│ People   ├─────────────────────────────────────────────────────┤
│ More     │ S Score · Variant · Players · Date         [Review]│
│          │   Score · Variant · Players · Date         [Review]│
│          │   More results…                                    │
└──────────┴─────────────────────────────────────────────────────┘
```

Short-wide использует широкие rows, не обязательный list/detail split. На достаточном large-screen fit можно закрепить details выбранной записи справа.

Primary action — Review. Seed, Share, tags и Other Scores находятся в details/context actions. JSON input не занимает первый экран History.

### Open replay

Это отдельная task: link/ID first, JSON — Advanced. Solo/Shared выбираются явно там, где допускаются existing replay semantics. Back ничего не открывает.

Если current room занята, просмотр History остаётся возможным, но новая replay session не создаётся тайно вместо неё.

### Review Workspace

```text
┌────────────────────────────────────────────────┐
│ SYSTEM STATUS                                  │
├────────────────────────────────────────────────┤
│ F [Browse] REPLAY #2011703       [Chat] [Menu]  │
│ F Result / Shared-follow / Hypothetical marker │
├────────────────────────────────────────────────┤
│ F Same C17 Ledger + resources                  │
│   Portrait or landscape A/B by fit             │
├────────────────────────────────────────────────┤
│ F T12 [Previous] ──timeline── [Next]             │
│ F [Follow leader] OR [Live], when meaningful   │
├────────────────────────────────────────────────┤
│ SYSTEM NAVIGATION — NO GLOBAL NAVIGATION        │
└────────────────────────────────────────────────┘
```

Live Rewind, dedicated replay, shared review и Hypothetical явно различаются текстом и controls.

Локальное движение shared follower не выглядит как broadcast. `Follow leader` доступен непосредственно в review task, не только в Menu.

`Other Scores` сохраняет existing eligibility, включая ограничения source lookup; наличие seed у любой записи не делает action автоматически поддержанным. `Play this seed` открывает обычный Create с prefill, не отправляет Create сам. 

Закрытие shared room и сохранение historical replay link — разные операции. Последний spectator может прекратить существование конкретной shared-review room; интерфейс не обещает её вечное сохранение. 

---

## 12. People / session Messages / Profile

### People directory

```text
PORTRAIT

┌──────────────────────────────────────┐
│ SYSTEM STATUS                        │
├──────────────────────────────────────┤
│ F People               [Room Return]│
│ F People | Messages                  │
│ F Search                             │
├──────────────────────────────────────┤
│ S Friends                            │
│   Alice · In game                  > │
│   Bob · Online                     > │
│   ────────────────────────────────   │
│   Online                             │
│   Carol · In lobby                 > │
├──────────────────────────────────────┤
│ F Home | History | People | More    │
├──────────────────────────────────────┤
│ SYSTEM NAVIGATION                    │
└──────────────────────────────────────┘
```

В landscape корень получает rail, широкий Search/filter toolbar и компактные user rows. На short-wide не появляется обязательная вторая колонка; она допустима только на large-screen fit.

### Messages list

```text
│ F People               [Room Return]│
│ F People | Messages                  │
├──────────────────────────────────────┤
│ F Messages seen by this client       │
├──────────────────────────────────────┤
│ S Alice · Last observed message    > │
│   Bob · Last observed message      > │
│                                      │
│   No conversations seen yet          │
│   — honest empty state when needed   │
├──────────────────────────────────────┤
│ F Home | History | People | More    │
```

Primary action — открыть conversation. Список не называется account-wide Inbox. Отсутствие сообщений здесь не означает отсутствия переписки на сервере.

### User/Profile и Conversation

```text
USER / PROFILE

│ SYSTEM STATUS                        │
│ F < Alice              [Room Return]│
├──────────────────────────────────────┤
│ S Known identity / presence          │
│   Friend state                       │
│   Current table, when known          │
│   [Message] [Friend / Unfriend]       │
│   Eligible contextual table action   │
├──────────────────────────────────────┤
│ F Browsing nav only for browse origin│
│ SYSTEM NAVIGATION                    │

CONVERSATION

│ SYSTEM STATUS                        │
│ F < Alice              [Room Return]│
│ F This client/session                │
├──────────────────────────────────────┤
│ S Transcript                         │
│   Reconnect gap notice when needed   │
│                           [New ↓]    │
├──────────────────────────────────────┤
│ F [Message…                  ] [Send]│
│ F Browsing nav only while IME closed │
│ IME / SYSTEM NAVIGATION              │
```

Profile из live participants и Conversation из room context не переключают автоматически вкладку People. Они возвращаются к своему origin и не показывают глобальные tabs.

В landscape Conversation становится широкой focused typing surface. На большом экране допускается conversations list + conversation pane.

### Messaging contract

V2 добавляет целостное представление **уже полученных этим клиентом PM**, а не новый messaging protocol.

Существующие источники дают session transcript и explicit-recipient sending; upstream command проверяет online recipient, сохраняет сообщение и рассылает chat events. Это не равно доступной клиенту полной history/sync capability.  

| Аспект | Решение v2 |
|---|---|
| Retention | RAM текущей авторизованной клиентской сессии |
| Навигация | Transcript/draft не исчезают от перехода между экранами |
| Обычный reconnect | Увиденные сообщения можно сохранить в памяти; возможный пропуск обозначается, не «дозаполняется» |
| Cold restart / logout / account switch | Нет обещания восстановления; данные другого аккаунта не показываются |
| Offline send | Не ставится в очередь |
| Offline recipient | Existing eligibility/error, без обещания отложенной доставки |
| Send success | Не превращается в `Delivered` или `Read` |
| Unread | Только наблюдаемое локальное состояние; не cross-device receipts |
| Typing / read receipts | Не показываются без подтверждённой capability |
| Local disk cache | Вне v2; отдельное решение с privacy/retention contract |

При неоднозначном исходе отправки после network loss интерфейс не делает автоматический resend.

Profile показывает только реально доступные сведения. Богатые account statistics и arbitrary-player history не имитируются из случайных локальных данных.

---

## 13. Browsing More / Settings / account

### More — отдельный организационный раздел

```text
PORTRAIT

┌──────────────────────────────────────┐
│ SYSTEM STATUS                        │
├──────────────────────────────────────┤
│ F More                 [Room Return]│
├──────────────────────────────────────┤
│ S Signed in as You                   │
│   My Profile                       > │
│   ────────────────────────────────   │
│   Settings                         > │
│   Tools                            > │
│   About / version                  > │
├──────────────────────────────────────┤
│ F Home | History | People | More    │
├──────────────────────────────────────┤
│ SYSTEM NAVIGATION                    │
└──────────────────────────────────────┘

LANDSCAPE

┌──────────┬──────────────────────────────────────────────────┐
│ F Home   │ F More                         [Room Return]    │
│ History  ├──────────────────────────────────────────────────┤
│ People   │ S Account identity / My Profile                 >│
│ More     │   Settings                                    >│
│          │   Tools                                       >│
│          │   About / version                             >│
└──────────┴──────────────────────────────────────────────────┘
```

Primary navigation action здесь — Settings, не Sign out. Профиль, Settings и Tools не оформляются как конкурирующие hero cards.

Tools содержит общие import/open-link возможности. Это дополнительные входы в те же tasks, а не второй implementation flow.

### Settings

```text
│ SYSTEM STATUS                        │
│ F < Settings           [Room Return]│
├──────────────────────────────────────┤
│ S Account & security               > │
│   Appearance                 System >│
│   Cards                            > │
│   Gameplay presentation            > │
├──────────────────────────────────────┤
│ F Home | History | People | More    │
│ SYSTEM NAVIGATION                    │
```

Account & security включает Change password, reset entry и Sign out. Security form — отдельная task без tabs, с очисткой секретных полей при завершении/отмене.

Cards сохраняет Colorblind mode, Styled card numbers и Reverse hand direction. Gameplay presentation — untimed timers, H-group features, Real-life mode. Эти группы не меняют семантику существующих settings или precedence. 

В landscape категории остаются компактным списком. List/detail возможен на большом экране, но password form не растягивается на всю ширину устройства.

Settings-from-room переиспользует содержимое, однако имеет room-owned chrome:

```text
│ F < Settings              [Return to game] │
│ S Same settings content                    │
│ NO GLOBAL NAVIGATION                       │
```

Sign out никогда не маскируется под обычный Back или выход из Profile.

---

## 14. Responsive и lifecycle rules

### Window classes

Класс определяется доступным окном **без вычитания IME**, но с учётом системных safe insets.

| Класс | Начальное правило | Browsing | Room |
|---|---|---|---|
| Compact | Не short-wide; ширина <600 dp | Bottom navigation, одна колонка | Portrait density allocator |
| Short-wide | Ширина > высоты; высота <480 dp либо <600 dp при aspect ratio ≥1,2 | Rail и compact header | A/B по полному fit |
| Medium | Оставшиеся окна 600–839 dp | Rail при достаточном fit; не обязательные две колонки | Composition по реальной геометрии |
| Large | Обычно ≥840 dp шириной и ≥600 dp высотой | Rail, optional list/detail | Расширенный workspace, без global navigation |

Это dispatch rules для композиции, не доказательство, что содержимое поместилось. Например, большой планшет в низком multi-window может попасть в short-wide.

### Начальные design tokens

| Элемент | Проектная величина |
|---|---|
| Browsing app bar | Минимум 56 dp, растёт по контенту |
| Room header | Минимум 48 dp, растёт при реальной необходимости |
| Browsing bottom navigation | Номинально 64 dp, не фиксировать вопреки font scale |
| Navigation rail | Номинально 72–96 dp, с измерением labels |
| Основной touch target | Не менее 48 × 48 dp, без overlap |
| Обычные внешние поля | 16 dp; dense room — отдельный измеренный budget |
| Form content max width | Около 560 dp |
| Reading/list content max width | Обычно 720 dp для одной колонки |
| Общий large-screen content cap | Около 1280 dp |

Typography: screen titles около 24–26 sp, section titles 18–20, основной текст 15–16, secondary metadata 13–14. Игровая плотность решается layout, а не массовым уменьшением шрифта.

### Font scaling

Title и actions не борются за последнюю узкую колонку: control переносится ниже. Return stacking обязателен.

Navigation labels не отключаются ради экономии места. При экстремально крупном тексте, когда четыре labels не проходят горизонтальный fit, browsing navigation допускает двухрядное расположение четырёх destinations. Это accessibility-адаптация только browsing, не способ вернуть navigation в Game.

На больших font scales дополнительные panels исчезают раньше, чем уменьшаются critical controls. Для подробного чтения карт и knowledge доступен увеличенный inspector. Он не считается доказательством пригодности normal 6P layout и не заменяет реальные руки на обычном масштабе.

### IME и overlays

Экран имеет одного владельца system/IME occlusion. Не допускается суммировать padding нескольких SafeArea/keyboard wrappers.

Short-wide editor получает full-height task surface, когда sheet больше не вмещает header, input и action. Внутренний scroll не может схлопнуться до нуля.

Для note task обязательны идентичность карты, draft, Save и Back/Cancel. Для Chat — recipient/room, transcript и composer. Глобальная navigation в focused typing не конкурирует с ними.

### Сохранение и сброс

| Событие | Сохранить | Сбросить |
|---|---|---|
| Rotation | Note draft/order, безопасный temporal context, global empathy, видимый clue plan | Pointer/hold, transient empathy, stale action arming |
| Background | Recoverable task state по C17 | Незавершённые жесты и commit readiness |
| Browse | Room ownership, безопасные drafts, browsing origin | Selection/arming; Clue Composer и его plan |
| Reconnect | Только допустимый local task context после authoritative resync | Любые предположения о готовности старого действия |
| Реальное изменение viewport/insets/font | Семантическую task identity | Старую geometry; она измеряется заново |
| Logout/account switch | Только разрешённые account-independent preferences | Session PM, private drafts и room-bound local state |

**Стабильная геометрия не означает сохранение максимального когда-либо измеренного прямоугольника.** После реального уменьшения окна старый размер не должен выталкивать controls за экран.

---

## 15. Component / design-system inventory

| Компонент или система | Статус | Требование v2 |
|---|---|---|
| Authoritative game selectors/rendering semantics | Keep | Не менять ради shell |
| Card artwork и identity channels | Keep | Сохранять suit/rank/knowledge/note distinctions |
| Gameplay interaction semantics | Keep + lifecycle integration | Новый shell не переопределяет tap/hold/commit |
| App shell | Replace | Browsing и Room — разные presentation hosts |
| Local navigation policy | Replace | Независимые stacks, origin и новый Back |
| Bottom navigation / rail | New | Четыре destinations, только разрешённые browsing surfaces |
| Room-aware app bar | New | Return C, stacking, актуальный state |
| Room header | Revise | Browse, Chat, Menu; identity/mode без глобальных tabs |
| Generic Panel usage | Reduce | Grouped lists вместо рамки вокруг каждой группы |
| Table row / history row / user row | Revise | Разные сущности, согласованная плотность и action hierarchy |
| Create form | Extract as task | Один canonical flow, subtask/picker ownership |
| Pregame roster/footer | Replace composition | Role/start first, details вторичны |
| C17 layout allocator | Revise | Portrait + A/B; capacity/font/tool envelope |
| Workbench shell | Revise | Geometry не зависит от активного tool |
| Chat presentation | Revise | Visibility-aware read, правильный recipient, pinned composer |
| User context actions | Split | Компактные actions и отдельные Profile/Conversation |
| Menu/sheet/dialog primitives | Replace geometry contract | Bounded viewport, no collapse, short-wide task fallback |
| Settings presentation | Regroup | Canonical categories, shared content across origins |
| Loading/error/empty states | Unify | Без ложного «пусто», когда данные ещё не получены |
| Motion/haptics | Restrained | Не владеют game meaning и не создают commit |

Selected, disabled, pending и error имеют разные визуальные состояния. Успех gameplay отображается по authoritative update, не только по успешному нажатию.

Destructive actions отделены от primary tasks. Reduced motion сохраняет тот же смысл без анимации.

---

## 16. Updated capability-impact table

**P** — presentation/local UI state.  
**R** — использует существующий mobile runtime.  
**S** — известная server capability, требующая новой mobile integration.  
**N** — новая или не подтверждённая на зафиксированной базе server capability.

| Изменение | Класс | Граница |
|---|---|---|
| Home/History/People/More и independent stacks | P | Без server navigation |
| Browsing при attended room | P + R | Один runtime; меняется visibility/focus |
| Return C | P + R | Для attended room локальный возврат; Rejoin — отдельный existing path |
| Consume Back в обычных Live/Pregame | P | Явное изменение shell policy |
| Разделение More и contextual Menu | P | Не меняет commands |
| Отдельный Create | P + R | Existing create/preferences/seed semantics |
| Pregame density/Start/role UI | P + R | Existing eligibility и proposals |
| Portrait/A/B layout | P | Не меняет card identity, rules или visibility |
| Safe task suspension/resume | P | RAM, без сохранения gameplay intentions |
| Chat read по visibility | P + R | Existing read capability, корректный moment вызова |
| Session Messages/Conversation | P + R | Existing PM events/send; новая связная presentation |
| In-memory transcript через reconnect | P | Не восполняет сообщения, пропущенные клиентом |
| History/details/import hierarchy | P + R | Existing data и replay entry |
| Settings-from-room / browsing Settings | P + R | Одно содержимое, разные presentation origins |
| Явное переключение между room sessions | P + R | Последовательные existing attendance transitions |
| Lobby send поверх attended room | Не включено | Требует отдельной проверки contextual routing; не объявлено бесплатной P-задачей |
| Durable local PM cache | Вне v2 | Новая platform persistence и privacy contract, но не account-wide server history |
| Durable account PM history / offline delivery / cross-device sync | N | Не поддерживается визуальным обещанием v2 |
| PM read receipts / typing | N до подтверждения | Не рисовать фиктивные статусы |

Обязательное ядро v2 не требует новых server capabilities. Отдельный S-slice не добавляется только ради расширения scope.

---

## 17. Updated decision log

| Решение | Проблема / основание | Отклонённая альтернатива | Влияние |
|---|---|---|---|
| More вместо Settings | Четвёртый раздел должен вмещать account/tools breadth | Top-level Settings как контейнер всего | IA only |
| Contextual Menu вместо второго More | Разные owners скрывались под одним названием | Два одинаковых More | Labels и surface ownership |
| Нет global navigation в Room | Высота нужна gameplay | Tabs поверх Live/Replay | Отдельный focused shell |
| Bare player Live Back consumed | Случайный системный жест не должен менять рабочий контекст | Back → Browse | Версионированная shell policy |
| Pregame и spectator используют тот же bare-room Back | Смена роли/Start не должна менять смысл жеста | Role-dependent implicit departure | Без новых protocol semantics |
| Return C | Сохранить постоянный возврат без нижней полосы во всех browsing roots | Floating chip; обязательный mini-bar | Новый app-bar contract |
| Return из собственного Rewind явно ведёт в Live | Нельзя выдавать старый temporal state за актуальную игру | Необозначенный resume Rewind | Явный existing temporal action |
| Create как task | Inline form вытесняла discovery | Постоянная Create-колонка | Canonical task flow |
| Leave убран из Pregame footer | Редкая attendance-команда конкурировала со Start | Start и Leave рядом постоянно | Menu placement |
| A/B выбираются по fit | Orientation недостаточно | `wide` / stretched portrait | Layout policy |
| Tool envelope не зависит от текущего tool | Composer не должен двигать руки | Пересчитывать Ledger на каждый tool | Geometry invariant |
| Messages только внутри People | Session PM не равен полноценному Inbox | Top-level Messages с durable appearance | Честная capability boundary |
| Visibility владеет chat read | Mounted скрытый Chat может очищать unread | Read on mount | Local effect ownership |
| Shared content сохраняет origin | Settings/Profile не должны создавать мини-навигации | Дублирование экранов для каждого entry point | Navigation consistency |

---

## 18. Acceptance criteria

### Функциональные и safety gates

| Область | Проверяемый результат |
|---|---|
| One room | Ни один browsing flow не создаёт второй authoritative room runtime |
| Browse | Ноль Leave/Unattend-команд от Browse, tabs и обычного browsing Back |
| Return | Из каждого разрешённого browsing screen — одно явное действие до текущего room workspace |
| Bare Live Back | Player остаётся в Live; нет Browse, dialog или attendance send |
| Bare Pregame Back | Та же политика до и после Start |
| Layered Back | Один Back обрабатывается одним верхним контекстом; Note/IME/Rewind правила не смешиваются |
| Global navigation | Отсутствует во всех focused Pregame/Live/Rewind/Replay/Shared/Hypothetical и room-owned children |
| Create | Back не отправляет `tableCreate`; создание только после финального Create |
| Gameplay commit | Selection, rotation, overlay dismissal, Return и reconnect не отправляют Play/Discard/Clue |
| Card identity | Draft/inspection/action относятся к исходному `card.order` после draw/reverse/rotation |
| Review isolation | Ни из одного review/hypothetical UI не появляется live-send path |
| Chat routing | Visible room/recipient совпадает с фактическим маршрутом отправки |
| Chat read | Скрытые и background surfaces не помечают сообщения прочитанными |
| PM promises | Нет delivered/read/offline-queue/account-history claims без capability |
| Privacy | Logout/account switch не показывают transcript/draft предыдущего аккаунта |

### Product и layout gates

| Область | Проверяемый результат |
|---|---|
| Home | При наличии доступных столов первый экран содержит полноценную actionable table row, а не только chrome |
| Create discoverability | В обычном свободном Home Create виден без открытия More |
| Pregame | Роль, leader, заполненность и primary action доступны без прокрутки через Team tools |
| Pregame scan | В usability-проверке пользователь может определить свою роль и способ старта за несколько секунд; ошибки фиксируются как дефект hierarchy |
| Return C | Title не сжимается до нечитаемой колонки; при нехватке ширины происходит stacking |
| YOUR TURN | Отличается от спокойного Live и review не только цветом |
| Short-wide | Home, Create, Pregame и Live имеют предусмотренные композиции, а не stretched portrait |
| A/B | Каждый выбранный layout проходит численные width/height/touch/tool assertions |
| Geometry stability | Card/hand rectangles не меняются при Card/Clue/Note/Rewind tool switch внутри одного envelope |
| 2–6P | На целевой normal-phone matrix сохранены реальные card faces и пригодные действия; shell не ухудшает dense baseline |
| Capacity | Проверяется максимальная поддержанная hand capacity, а не только неполная late-game hand |
| Text scale | 1.0 / 1.3 / 1.5 / 2.0: нет потерянных primary actions, collapsed text и недоступного Return |
| IME | Note/Chat/password tasks сохраняют target, input и необходимые actions |
| System UI | Проверены gesture и three-button navigation, обе landscape стороны |
| Overlays | Нет нулевой content height, невидимого scroll и controls под system bars |
| Performance | Новый shell не подписывает все browsing surfaces на каждый scrub segment; final scrub position остаётся корректной |
| Finished transition | Result/replay не вытесняет workspace в несвязанный renderer и не меняет room без authoritative transition |

### Матрица проверки

Минимум: основной A55-class телефон, меньший телефон, large-screen environment; portrait и обе landscape-ориентации; 2P, 3P, 4P, 6P; supported extra-card/suit cases; длинные имена; IME; font scaling; rotation/background/reconnect.

**Геометрический PASS не равен physical PASS.** Если все прямоугольники формально поместились, но card faces или targets неудобны для обычной серьёзной игры, срез не принят.

---

## 19. Incremental implementation plan

Каждый срез оставляет рабочий основной путь. Поддержка landscape входит в foundation и gameplay composition, а не переносится целиком в финальный polish.

| Срез | Область | Риск | Gate перед следующим шагом |
|---|---|---|---|
| **0. Зафиксировать v2 contract** | IA, Back, More/Menu, Return, room/task ownership | Низкий | Устранены противоречия с первой версией документа и shell decisions C17 |
| **1. Navigation state separation** | Browsing stacks, origin, room-owned children | Средний | Локальная навигация не меняет authoritative room |
| **2. Responsive/surface foundation** | App bars, rail/bottom nav, safe/IME ownership, sheet/task geometry | Средний | Compact и short-wide fixtures; no collapse |
| **3. Browsing More + canonical Settings** | More root, settings categories, account/tools routing | Низкий–средний | Нет table commands в browsing More; один canonical content flow |
| **4. Home + Create task** | Table rows, discovery order, Create/subtasks/pickers | Средний | Preferences, passwords, seed prefill и create guards сохранены |
| **5. Pregame portrait/landscape** | Roster, role/footer, Table menu, proposals | Средний | Start/role/leave flows и bare Back соответствуют v2 |
| **6. Safe task/visibility ownership** | Draft suspension, chat read, hidden-screen effects, input interruption | Высокий | Скрытые поверхности не читают chat и не сохраняют unsafe arming |
| **7. Browse + Return C** | Room-aware header, explicit Browse, revised Back, return guards | Высокий | Один runtime; one-action Return; ноль implicit attendance sends |
| **8a. Live portrait shell** | Header, compact HUD, Workbench envelope | Высокий | 2–6P baseline не ухудшен; tools не двигают Ledger |
| **8b. Landscape A/B** | Обе композиции, fit selection, font/capacity fixtures | Высокий | Выбор по измерению; ordinary target windows проходят без tiny-card excuse |
| **9. Chat и contextual menus** | Bounded overlays/tasks, correct context, Settings-from-room | Средний | IME, Return, unread, menu nesting и attendance confirmations |
| **10. History/Review** | List-first hierarchy, import task, temporal/shared surfaces | Средний | Replay guards, source eligibility, origin restoration и isolation |
| **11. People/Session Messages/Profile** | Directory, session conversation list, shared user surfaces | Средний | Честная retention boundary, account isolation, send uncertainty |
| **12. Physical hardening** | Полная acceptance matrix, density, accessibility, performance | Высокий | Проверенный build на устройствах, не только screenshots/tests |
| **13. Удаление заменённых presentation paths** | Старые shell/layout branches и дублирующиеся handlers | Средний | Нет нужды в постоянных параллельных UX-архитектурах |

Browse при сохранённой room не включается раньше безопасного task/visibility ownership. Иначе новая навигация внешне заработает, но принесёт потерю drafts, скрытые read effects и stale interaction state.

Ни один срез не использует redesign как повод одновременно обновить upstream pins, переписать rules, изменить Pace/Eff semantics или добавить command replay.

---

## Ready for implementation?

**Да. Нерешённых продуктовых вопросов, блокирующих реализацию по этой v2, не осталось.**