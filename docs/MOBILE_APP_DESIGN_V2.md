# Hanab Mobile — Design Specification v2

**2026-10-23 bounded supersession:** [Post-RC2 UX polish](./2026-10-23-UX-POLISH.md) supersedes only the listed landscape, notes/gestures, Home/Exit Replay and finish-presentation clauses. Other decisions and all gameplay/network safety remain authoritative. This is a target contract, not physical acceptance.

**Статус:** **ратифицированная** финальная спецификация перед реализацией (2026-09-28, merged via #142).  
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

**Обычный player Live: Back consumed. Обычный player Pregame: также consumed. Browsing Home открывается явной кнопкой `Home` (revision 2026-10-23).**

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

В bare Live/Pregame Back не открывает диалог «Выйти?», не требует двойного нажатия и не запускает скрытый exit flow. Кнопка Home остаётся видимой.

Начало и отмена системного Back gesture не выполняют команд. Предпросмотр перехода должен соответствовать реальному результату: bare Live не должен показывать будущий Home, если финальное действие будет consumed.

Действия `Leave table`, `Unattend`, `Stop watching`, `Close review` остаются явными. Where confirmation applies, it explains the consequence; the 2026-10-23 direct `Exit Replay` action requires no confirmation, including Shared leaders. Preserve destructive Terminate confirmation. Unattend player не следует называть завершением партии.

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

## 8. Live portrait specification — Slice 8a

Portrait means `viewportWidth <= viewportHeight`. Slice 8a replaces the earlier Live portrait specifics. Slice 8b adds landscape in §9 without changing this portrait contract.

```text
[Home] <current variant> [Chat] [Menu]
Turn → Pace → meaningful Efficiency/FRE
[Score / Fireworks] [Clues / Strikes] [Deck]
[Discard Pile]
[Last Action + Rewind + Empathy + RECENT ›]
[own hand if Top]
[opponent real-card hands]
[own hand if Bottom]
[Workbench fixed at physical bottom above safe area]
```

Home always opens the browsing Home root, sets presentation focus to browsing, and preserves attended room/runtime. It never means the previous browsing destination and never sends Leave/Unattend. The 2026-10-23 delta extends this visible Home label/destination to Pregame and all focused game/review contexts. Current variant is always visible, including standard/default variants; fitting/ellipsis is allowed. Username and game/table id do not appear in the portrait Live header.

Turn number, Pace and meaningful Efficiency/FRE stay near the top. No additional actor-name line is required; hand-row highlighting identifies the current player. Score is compactly shown as `Score 12 / 25` near real firework stacks. A read-only Deck with remaining count sits to their right. Bottom-Deck Blind-Play / deckPlays remains unsupported.

Clues use a numeric count; Strikes use three compact square slots with active strikes marked. Keep resources beside fireworks when width meets `30dp * suitCount + 42dp deck + resourceRail + 28dp gaps/padding`, with `resourceRail = max(64, ceil(64 * min(fontScale, 1.5)))`. Otherwise move Clues/Strikes into their own compact row, preserving valid fireworks geometry.

Discard Pile is a separate tappable block opening the existing full DiscardViewer. Preserve max-clue red blocked and H-group yellow double-discard cues. Compact discard faces include only cards whose authoritative engine status is not `CardStatus.Trash`; hand-specific `shouldFade` is not the criterion. Preserve suit-stack order and individual duplicates, never aggregate as ×2. A local horizontal mini-card scroller is allowed. A nonempty all-trash pile shows `No relevant cards` and remains tappable. Full DiscardViewer shows every discard and fades engine-trash cards using the existing ~0.6 opacity.

Last Action remains a readable compact panel with meaningful authoritative summary, RECENT ›, Rewind and Empathy. It must not deliberately collapse to one terse line.

### Hand ledger and preference

Settings → Gameplay presentation exposes Own hand position: Top / Bottom, default Bottom. This Redux presentation preference is independent of server/gameplay state and upstream/web keldonMode. It survives logout/account changes in the same app store/process; process restart may reset it. No persistence dependency is introduced.

Bottom orders opponents before the own/observed hand, immediately above Workbench. Top orders the own hand before opponents. Stable server-relative seating and durable `card.order` identity remain unchanged; current actor does not reorder hands.

2P–5P always use real card faces with no per-hand scrolling. Shrink cards within valid readable bounds to fit the normal portrait envelope. Portrait CompactHandCardSummary and compact-overview are forbidden. In 6P first fit all five opponents normally; if this requires opponents below the 46dp dense floor, only opponents may vertically scroll. The own hand stays fixed on the selected side. Target four visible opponent rows plus own when four 46dp rows fit, otherwise three plus own. If three cannot fit at 46dp, shrink enough to show three real-card rows. No portrait root gameplay scroll, including short-height portrait escape.

### Workbench and authoritative feedback

Workbench is pinned to the physical bottom above safe area, with one stable outer rectangle determined by shell viewport/player count, never the open tool. Card → Clue → Note → Rewind → Hypothetical changes do not move/resize hands. 2P–3P reserve 176dp at viewport height ≥780, 156dp at ≥640, otherwise 140dp. 4P–6P reserve 56dp. Long task content may scroll locally inside this rectangle. Idle is visually blank and keeps the same reserve.

Selected-card content shows applicable Play, Discard, Edit note and note preview only. Selection on the actual card identifies the target; Workbench does not show card.order, card #17, slot 3 or Actor card N. Internal durable routing state remains intact.

C17 temporal presentation derives `cardOutcome: played | discarded | misplayed | null` from authoritative post-state, including existing `isMisplayed` truth. No optimistic feedback. The mounted C17 workspace observes new authoritative segments and records local-player card confirmation as calm `Played`, `Discarded` or `Misplayed`, the actual face, and textual Close. Misplayed is not error/red/alarm styling. Feedback has no timer/toast and persists until Close, another Workbench task/tool, or a new gameLoadEpoch. Other-player actions do not dismiss it.

Seed observation to the current latest segment on initial mount/reconnect; never synthesize stale feedback. New gameLoadEpoch clears and reseeds. Rotation, background and Home/Browse in the same game preserve feedback; Return may show own confirmation recorded while hidden.

### Home/Browse and Return safety

Hidden presentation still disarms selection/arming, closes discard inspection and clears visible Clue planning. Recoverable note draft retains its original card.order. Hidden authoritative feedback observation is allowed solely as harmless local presentation state: it sends nothing, mutates no authoritative state, never re-arms and never queues/retries/replays. Own-hand preference changes while hidden affect layout only. Return, closing overlays and reconnect never confirm an action; a new deliberate action is required.

---

## 9. Live landscape — Slice 8b

Slice 8b implements one landscape topology, superseding the earlier A-preferred/B-fallback selection, separate enlarged own-hand anchor and 860 × 388 A/B example. Alternate landscape geometry and a preference/toggle remain future work.

```text
+------------------------------+-----------------------------------+
| Home · variant/Replay · Chat/Menu | Score · Pace · Efficiency     |
| HAND GRID                    | Fireworks · Clues · Strikes · Deck |
| Equal-size real-card hands   | Relevant individual Discard Pile   |
| Deterministic seating        | Last Action · RECENT ›            |
|                              | Workbench                         |
+------------------------------+-----------------------------------+
```

The 2026-10-23 delta places the header only above the left hand grid; the right column starts at safe-content top. Home opens browsing Home, preserving attendance/runtime in all focused contexts. Always show current variant/Replay identity; variant fitting/ellipsis is allowed. Chat/Menu retain actions and unread/disabled states. No username, game/table id or turn clutter in the Live header.

### Deterministic grid

All hands use the same card height; own/observed hand is never enlarged. Use existing seatingAnchorIndex/server-relative order. Own hand Top/Bottom is the existing presentationPreferences setting, with no new state or persistence. Actor highlighting never reorders cells.

| Players | Template | Own hand placement |
|---|---|---|
| 2P | 1 column × 2 rows | First/last for Top/Bottom |
| 3P | 1 column × 3 rows only | First/last for Top/Bottom |
| 4P | 2 × 2 | First/last cell |
| 5P | Two paired opponent rows + centered own single row | Own row first/last |
| 6P | 3 rows × 2 columns; never 2 rows × 3 columns | First/last cell |

3P uses only 1 column × 3 rows. The former 294dp body threshold is a Slice 8b baseline, not proof of fit after the 2026-10-23 delta: measure the left-only header, card floor and worst-case right controls together.

### Pure geometry and elastic divider

The allocator takes only availableWidth, availableHeight, fontScale, playerCount, cardsPerHand, seatingAnchorIndex and ownHandPosition. Capacity comes from getGameplayCardsPerHand(metadata), never remaining hand length. Turn, tool, note, clue, review and depletion cannot change template, divider, cards or Workbench rectangle.

Use HANABI_CARD_ASPECT_RATIO = 286 / 406. Card gap 3dp; hand-column gap 6dp; hand-row gap 4dp; left/right gap 8dp; hand-cell horizontal padding 8dp total; label chrome 18dp plus existing card headroom. Card floor 68dp; comfort maximum 112dp.

Solve the largest integer vertical and horizontal card heights ≤112 fitting all rows and the widest row while reserving rightMin. cardHeight = min(verticalMax, horizontalMax, 112). Below 68 fails; older 42/46dp floors and compact summaries are not landscape solutions.

- scaledFont = clamp(fontScale, 1, 1.5)
- Slice 8b baseline rightMin = 252 + ceil(48 × (scaledFont − 1)); the 2026-10-23 delta requires validating the complete full-size Score/Pace/Efficiency row and variant palettes, increasing reservation only if readable cards still fit.
- Slice 8b baseline rightComfort = 320 + ceil(32 × (scaledFont − 1))
- leftNeeded = actual widest grid-row width
- maxRight = availableWidth − 8 − leftNeeded; fail if maxRight < rightMin
- rightWidth = min(rightComfort, maxRight)
- leftWidth = availableWidth − 8 − rightWidth

Center the grid inside leftWidth. Readable hands take priority, then a valid right minimum, then comfortable right width. Whitespace is allowed; no percentage split or card stretching merely to fill space.

PR1 (2026-10-23) replaces those baseline reservations with `scaledFont = max(1, fontScale)`, `rightMin = max(ceil(252 * scaledFont), ceil(native fixed-probe width))` and `rightComfort = max(rightMin, 320 + ceil(32 * (scaledFont - 1)))`. Native intrinsic probes use the unchanged Score/Pace/Efficiency typography, full actual values and a fixed large-value reference (`Score 999 / 999`, `+999`, `999.99 | 999.99`); the reference is a layout stress envelope, not a new protocol/value limit. Actual values are also measured and fail closed if they exceed the reserved row. Probe dimensions never depend on player count or active tool; only the fixed reference contributes to allocation. Probes are inert and excluded from accessibility.

The left column subtracts the measured left header plus a fixed 30dp × scaledFont temporal/cue lane from its grid height. The right metric row reserves `ceil(34 * scaledFont)`; its natural measured height and width must fit before gameplay is exposed. Right body minimum remains metric height + 92 + 68 + 12 + 88 until PR3 revises the mandatory Clue envelope. Inputs are safe-content dimensions already measured under App's single system-inset owner; no second subtraction. Three 68dp card rows need 278dp before the left header: at a 48dp header, a 324dp safe-content height fails the 326dp minimum explicitly. These are deterministic geometry checks, not physical Android PASS.

The left width also reserves the native intrinsic Home/Chat/Menu widths (including the full unread count), 28dp for three gaps and horizontal padding, and a minimum identity slot of `ceil(48 * scaledFont)`. Pending header measurements do not expose gameplay. Impossible allocation retains Home/Chat/Menu in a full-width non-gameplay fallback header; controls must not overflow into an actionable right row. Header identity may ellipsize within its reserved slot.

Unread updates measure the replacement Chat label in an inert probe while retaining the validated label/envelope. They do not invalidate every control or temporarily unmount the table. Mounted App regression tests supply layout events and check preserved card instances/selection across incoming chat, probe completion and clearing unread; supplied layout events are not native Android font evidence.

PR2 keeps the normal-font resource envelope at 92dp: a 44dp Fireworks/Clues/Strikes/Deck row, 4dp gap and 44dp Discard Pile with 36dp relevant individual faces (formerly 20dp). Scale the first row/rail/deck allocation with text; preserve individual duplicate/relevance and full-pile access. The row's explicit minimum width accounts for every 30dp firework face, suit gaps, resource rail, deck and padding, and contributes to the right minimum for expanded variants. This protects mandatory resource fit, not a player-count-specific widget or a card-size tradeoff for discards.

Landscape Last Action is `ceil(28 * scaledFont)` with one ellipsized line, full accessible event text and Recent/history tap. Its former Rewind/Empathy controls move into a permanently available Workbench secondary row, including when no card/tool is selected. The released Last Action height raises the Workbench reserve to 128–168dp; compact empty primary rows do not consume action space. At fontScale 1 the complete right minimum remains 294dp. Larger text reserves larger resource/summary rows and fails explicitly if the action reserve cannot fit. The dedicated worst-palette/sticky-control proof remains PR3; discard growth uses only the space recovered inside the resource panel, never steals from primary actions.

### Right Live column

**2026-10-23 revision:** the following numeric envelopes record the previous Slice 8b baseline only and are not sufficient fit criteria for the revised composition. Measure full-size Score/Pace/Efficiency and worst supported Clue Composer with sticky Give/Close, card floor, font scaling and safe insets before accepting windows. Use the bounded size-failure path for impossible geometry; do not shrink metrics or hide mandatory controls.

| Region | Fixed envelope |
|---|---|
| Metric strip: mode/Turn, Pace, meaningful Efficiency/FRE | 34dp |
| Table/resources plus separate Discard Pile | 92dp |
| Readable Last Action, RECENT ›, Rewind, Empathy | 68dp |
| Three region gaps | 12dp |
| Workbench | Minimum 88dp, comfortable maximum 128dp |

Minimum body height is 294dp. Workbench height = min(128, bodyHeight − 34 − 92 − 68 − 12), pinned to the right-column bottom. Extra vertical space is allowed. Reserve H-group cue space inside the metric strip, fitting/truncating without changing height. The highlighted hand identifies the actor; no separate actor-name line.

CompactTable uses explicit landscape-v2 / portrait-v2 modes, with legacy as the default. Landscape moves existing Score n / max to the first right row beside existing Pace/Efficiency, preserving full FRE | MRE, typography, details and low-score cues/pulse. Keep real fireworks, read-only visual Deck/count, numeric Clues and three strike slots below, without duplicate Score. Enlarge relevant discard faces only after mandatory Workbench fit. Reuse the portrait discard selector: CardStatus.Trash relevance, duplicates individually, red max-clue blocked/yellow H-group double-discard cues, full DiscardViewer, and `No relevant cards` for nonempty all-trash piles. No deckPlays or ×2 aggregation. Portrait is unchanged.

Last Action is a one-line tappable summary with accessible detailed Recent/history. Landscape idle retains the ordinary Rewind/Empathy secondary controls; portrait idle is unchanged. Its fixed envelope must fit worst supported two-row color/rank palettes (including >5 choices), with palette-only local scroll/wrap and always-reachable Close/Give. Card Play/Discard, Rewind/replay, Shared and Hypothetical controls remain accessible; tools do not resize hands. Landscape Note Editor replaces the normal right column without obscuring hands when IME is closed, enters edit without forced keyboard, and preserves one draft/order transaction with safe Save/Cancel under system/IME insets. Feedback retains Slice 8a lifetime and calm styling.

### Failure and lifecycle

Eligible C17 never root-scrolls in either orientation. Keep one stable App ScrollView with gameRootScrollable = !c17Workspace. Grid/right column do not scroll. Shared private hand renderers preserve card.order, selection, notes, clue/preview markers, empathy, card state, hold gestures, clocks, actor indication, pulses and eligibility.

Insufficient width, card floor or body below 294dp produces explicit allocation failure and a bounded non-scrolling notice: “This landscape size cannot fit the Live workspace. Rotate the device or use a larger window.” This is a layout blocker/evidence path, not accepted normal 6P fit. No alternate topology, hidden mandatory controls or compact summaries. Physical device fit remains pending.

Rotation preserves mounted GameScreen/C17GameScreen and C17DenseWorkspace ownership, Note Editor/draft, recoverable tasks, feedback and room/runtime. Navigation never implicitly changes attendance. Inspection does not create a live gameplay send path. Networking, rules and command lifetime remain unchanged.

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

Landscape Chat replaces exactly the existing Slice 8b right column, using `landscapeLayout.rightWidth`. There is no full-window Chat fallback. The left hand grid, divider, and card geometry do not reflow; Chat does not change the landscape allocator inputs.

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

Chat, Home, direct Exit Replay where applicable, и Return to Live не прячутся исключительно в Menu.

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
│   Portrait or landscape grid by fit             │
├────────────────────────────────────────────────┤
│ F T12 [Previous] ──timeline── [Next]             │
│ F [Follow leader] OR [Live], when meaningful   │
├────────────────────────────────────────────────┤
│ SYSTEM NAVIGATION — NO GLOBAL NAVIGATION        │
└────────────────────────────────────────────────┘
```

Live Rewind, dedicated replay, shared review и Hypothetical явно различаются текстом и controls.

**2026-10-23 revision:** the review diagram's Browse becomes Home (always browsing Home, preserving attendance); replace persistent Result clutter with necessary temporal/shared anchors. Provide direct confirmation-free Exit Replay for ordinary/finished/shared review through safe authoritative departure, restoring supported browsing origin only after attendance confirmation. Failed sends must not claim exit; own ongoing Rewind Live never unattends. Show one restrained Game finished score/reason popup with Continue to replay only for a real observed active-to-finished transition, never historical load, reconnect rehydration, rotation or refocus. Preserve authoritative Last Action; no separate results page or persistent extra result banners.

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
| Short-wide | Ширина > высоты; высота <480 dp либо <600 dp при aspect ratio ≥1,2 | Rail и compact header | Live grid/right column по §9 fit |
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

Short-wide editor получает full-height task surface, когда sheet больше не вмещает header, input и action. Внутренний scroll не может схлопнуться до нуля. The 2026-10-23 landscape Note Editor replaces the right pane while IME is closed, without forced keyboard or hand reflow; temporary measured typing presentation is allowed when IME occludes that geometry, with Save/Cancel safe and the same draft preserved.

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
| C17 layout allocator | Revise | Portrait + Live landscape grid; capacity/font envelope |
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
| Portrait/landscape grid layout | P | Не меняет card identity, rules или visibility |
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
| Live landscape grid uses explicit fit floors | Orientation недостаточно | A/B fallback / stretched portrait | Layout policy |
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
| Live landscape grid | Explicit width/height/card-floor assertions; unsupported geometry is a blocker |
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
| **8b. Live landscape shell** | One topology, deterministic grid, elastic divider, font/capacity fixtures | Высокий | Explicit 68dp/294dp floors; physical validation pending |
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
