/**
 * Play Store listing copy, keyword-optimised.
 *
 * ASO-3 (Sep 10 2026) - maximise every indexed field + widen locale coverage.
 *  1. Titles now carry the exact top-volume phrase and use 26-30 of 30 chars
 *     ("Bible Verse of the Day, Prayer" = bible verse of the day 246K/mo +
 *     verse of the day 201K/mo + prayer 74K/mo in one 30-char string).
 *  2. Short descriptions pushed to 69-78 of 80 chars, distinct tokens only -
 *     no filler words like "Plus".
 *  3. Full descriptions went from ~2.1K to 2.3-3.7K of the 4000 indexed chars
 *     via per-language long-tail tails (verse about anxiety, prayer for
 *     healing, morning prayer, night prayer, share image) + an FAQ block.
 *  4. Locale surfaces 8 -> 17. Each Play locale is its own index: en-GB, en-ZA
 *     (NG/KE/ZA "word for today" phrasing), en-IN, en-SG, pt-PT, es-ES, it-IT
 *     (vangelo del giorno 135K/mo, KD 47), pl-PL (modlitwa poranna, low comp),
 *     sw (Biblia Takatifu, East Africa) added.
 *  Brand note: "Prayly" leaves the titles to free ~7 chars for keywords; it
 *  stays in the developer name, app content and every description.
 *
 * WHY ASO-2 CHANGED (Sep 1 2026)
 * The Aug 2026 pass led with "wallpaper" in every title. It bought volume but
 * the wrong intent: wallpaper searchers want a free image, not a subscription.
 * Measured over the last 14 days (PostHog, first-seen cohorts):
 *   - US (wallpaper-heavy, bot-polluted): 4.0% return rate, 2.0% wallpaper
 *     applied, 5.3% paywall CTA
 *   - IN / NG / MX / KE (prayer-intent markets): 26.8% / 20.0% / 25.0% / 50.0%
 *     return, 14.6% / 20.0% / 18.8% / 33.3% paywall CTA
 *   - PH: 40.1% return - our best retained market, prayer/verse driven
 *
 * The demand math also favours prayer/verse (Semrush, us + ph):
 *   verse of the day 201K/CPC $4.65 | bible verses 301K | daily bible verse
 *   110K/$1.74 | daily devotional 135K/$1.66 | scripture of the day 40.5K/$4.04
 *   vs jesus wallpaper 27.1K/CPC $0.67 | christian wallpaper 18.1K/$0.89
 * ~10x the volume and 2-6x the CPC. CPC is the cleanest public proxy for
 * monetisable intent: advertisers pay $4.65 for a verse-of-the-day searcher and
 * $0.67 for a wallpaper searcher. Ranking on the cheap cluster is what capped
 * conversion.
 *
 * NEW STRUCTURE
 *  - Title: brand + verse + prayer. "Wallpaper" leaves every title.
 *  - Short description: verse + prayer + devotional first, one wallpaper token
 *    at the end so the wallpaper cluster stays indexed (short description is a
 *    ranking field) without framing the app as a wallpaper app.
 *  - Full description: first 3 lines (the pre-"read more" fold) are prayer and
 *    Scripture. Verse -> Prayer -> Journeys -> Wallpaper -> Growth -> Why.
 *    Wallpaper keywords stay present ~3x for indexing, just not up front.
 *
 * Local-language targets retained:
 *  - br : versiculo do dia 550K, devocional diario 90.5K, oração do dia 27.1K
 *  - mx : versiculo del dia 9.9K, oracion del dia 5.4K, imagenes de jesus 22.2K
 *  - in : jesus images 74K, bible in hindi 9.9K
 *  - id : alkitab 135K, renungan harian 135K, ayat alkitab 27.1K, doa harian 8.1K
 *  - ph : bible verse 165K, verse of the day 74K, gospel for today 74K,
 *         tagalog prayer 12.1K, panalangin sa umaga 2.4K
 *
 * The high-difficulty "bible app" cluster (KD 78-92) is still avoided as a
 * primary target. Brand token "Prayly" is retained in every title.
 *
 * Play limits: title <= 30, shortDescription <= 80, fullDescription <= 4000.
 */

export interface PlayListing {
  language: string;
  title: string;
  shortDescription: string;
  fullDescription: string;
}

const EN_FULL = `Your daily Bible verse, your daily prayer, and a short devotional you will actually finish - every single day.

Prayly is a free daily Bible verse and prayer app. Open it in the morning for the verse of the day, pray with words already written for you, and keep God's Word on your lock screen all day long.

DAILY BIBLE VERSE & VERSE OF THE DAY
- A fresh daily Bible verse every morning, chosen to encourage you
- Verse of the day with a short reflection you can read in one minute
- Read in KJV, NIV or ESV and save your favourite Bible verses
- Scripture of the day for peace, strength, hope, healing and gratitude

DAILY DEVOTIONAL
- A short daily devotional every day - real Bible study without the overwhelm
- Bible verses about anxiety, fear, faith, forgiveness, money and healing
- Build a streak and make time in God's Word a daily habit

DAILY PRAYER, MORNING PRAYER & PRAYER ALARM
- 365 written prayers with calm narrated prayer audio
- Morning prayer and evening prayer for every day of the year
- A prayer alarm you control - set your own morning and evening prayer bell
- Gentle prayer reminders to pause, breathe and talk to God
- A quiet Sanctuary space for prayer, worship and stillness

GUIDED FAITH JOURNEYS
- Multi-day devotional journeys: anxiety, forgiveness, gratitude, purpose, grief, healing, money, rest
- One short step a day - Scripture, reflection and prayer
- Perfect if you have never managed to keep a daily devotional going

BIBLE VERSE WALLPAPER FOR YOUR LOCK SCREEN
- Bible verse wallpaper that changes with the daily verse
- Hundreds of HD Jesus wallpapers and Christian wallpaper backgrounds
- 3D parallax live wallpaper - the cross moves gently as you tilt your phone
- One tap to apply on lock screen, home screen, or both

MORE TO GROW IN FAITH
- Bible quiz to test and grow your Scripture knowledge
- Ambient worship soundscapes while you read and pray
- Available in English, Spanish, Portuguese, French, German, Hindi, Indonesian, Filipino, Italian, Polish and Swahili

WHY BELIEVERS LOVE PRAYLY
Most days we mean to pray and never get to it. Prayly makes it easy: the daily verse is already waiting, the prayer is already written, and the reminder is gentle. Then your lock screen keeps God's Word in front of you all day - a reminder that you are loved, held, and never alone.

Whether you want a daily Bible verse, a daily devotional, a prayer app, morning prayer, evening prayer, Bible study prompts or Jesus wallpaper for your lock screen, it is all here in one calm place.

Free to download. No account needed to start. Works offline.

Walk with God every day.`;

const PT_FULL = `Um versículo do dia, uma oração guiada e um momento de paz com Deus - todos os dias. O Prayly é um app de devocional diário e oração feito para manter seu coração perto de Cristo, mesmo nos dias mais corridos.

Abra de manhã e leia o versículo do dia. Ore com palavras que já estão escritas para você. Termine o dia com a Palavra na tela de bloqueio.

VERSÍCULO DO DIA E DEVOCIONAL DIÁRIO
- Um novo versículo do dia toda manhã para encorajar sua caminhada
- Devocional diário curto e reflexão que você consegue terminar
- Salve seus versículos favoritos e volte a eles quando quiser

ORAÇÃO DO DIA E ALARME DE ORAÇÃO
- 365 orações escritas com áudio narrado e calmo
- Oração da manhã e oração da noite para cada dia do ano
- Alarme de oração que você controla - defina um sino de manhã e de noite
- Lembretes suaves para parar, respirar e conversar com Deus

JORNADAS DE FÉ
- Jornadas guiadas de vários dias: ansiedade, perdão, gratidão, propósito e cura
- Um passo curto por dia - Escritura, reflexão e oração
- Construa uma sequência e transforme sua caminhada com Deus em hábito

A PALAVRA NA SUA TELA DE BLOQUEIO
- Papel de parede bíblico com versículo para tela de bloqueio e tela inicial
- Centenas de papéis de parede de Jesus em HD e fundos cristãos
- Papel de parede 3D com efeito parallax - a cruz se move quando você inclina o celular
- Coleções: paz, força, esperança, cura e gratidão
- Um toque para aplicar na tela de bloqueio, tela inicial ou nas duas

MAIS PARA CRESCER NA FÉ
- Quiz bíblico para testar e aumentar seu conhecimento da Bíblia
- Um Santuário silencioso para oração e quietude
- Sons de adoração ambiente enquanto você lê e ora

POR QUE OS CRISTÃOS AMAM O PRAYLY
Quase todo dia a gente quer orar e acaba não orando. O Prayly facilita: o versículo está esperando, a oração já está escrita e o lembrete é suave. Depois a tela de bloqueio mantém a Palavra de Deus na sua frente o dia inteiro - lembrando que você é amado, sustentado e nunca está sozinho.

Grátis para baixar. Não precisa de conta para começar. Funciona offline.

Ande com Deus todos os dias.`;

const ES_FULL = `Un versículo del día, una oración guiada y un momento de paz con Dios - todos los días. Prayly es una app de devocional diario y oración hecha para mantener tu corazón cerca de Cristo, incluso en los días más ocupados.

Ábrela en la mañana para leer el versículo del día. Ora con palabras que ya están escritas para ti. Termina el día con la Palabra en tu pantalla de bloqueo.

VERSÍCULO DEL DÍA Y DEVOCIONAL DIARIO
- Un versículo del día nuevo cada mañana para animar tu caminar
- Devocional diario corto y reflexión que sí puedes terminar
- Guarda tus versículos favoritos y vuelve a ellos cuando quieras

ORACIÓN DEL DÍA Y ALARMA DE ORACIÓN
- 365 oraciones escritas con audio narrado y tranquilo
- Oración de la mañana y de la noche para cada día del año
- Alarma de oración que tú controlas - pon una campana en la mañana y en la noche
- Recordatorios suaves para detenerte, respirar y hablar con Dios

CAMINOS DE FE
- Caminos guiados de varios días: ansiedad, perdón, gratitud, propósito y sanidad
- Un paso corto cada día - Escritura, reflexión y oración
- Crea una racha y convierte tu caminar con Dios en un hábito

LA PALABRA EN TU PANTALLA DE BLOQUEO
- Fondo de pantalla con versículo bíblico para bloqueo y pantalla de inicio
- Cientos de imágenes de Jesús en HD y fondos cristianos
- Fondo animado 3D con efecto parallax - la cruz se mueve al inclinar el teléfono
- Colecciones: paz, fuerza, esperanza, sanidad y gratitud
- Un toque para aplicar en pantalla de bloqueo, de inicio o en ambas

MÁS PARA CRECER EN LA FE
- Quiz bíblico para poner a prueba y aumentar tu conocimiento de la Biblia
- Un Santuario silencioso para orar y estar quieto
- Sonidos de adoración de fondo mientras lees y oras

POR QUÉ LOS CREYENTES AMAN PRAYLY
Casi todos los días queremos orar y no lo hacemos. Prayly lo hace fácil: el versículo te espera, la oración ya está escrita y el recordatorio es suave. Después tu pantalla de bloqueo mantiene la Palabra de Dios frente a ti todo el día - recordándote que eres amado, sostenido y nunca estás solo.

Gratis para descargar. No necesitas cuenta para empezar. Funciona sin internet.

Camina con Dios cada día.`;

const HI_FULL = `हर दिन एक बाइबल वचन, एक प्रार्थना और परमेश्वर के साथ एक शांत पल। Prayly एक daily devotional और prayer ऐप है, जो आपके मन को मसीह के करीब रखने के लिए बना है - सबसे व्यस्त दिनों में भी।

सुबह खोलिए और आज का वचन पढ़िए। प्रार्थना के शब्द पहले से लिखे हुए हैं। दिन का अंत लॉक स्क्रीन पर परमेश्वर के वचन के साथ कीजिए।

आज का बाइबल वचन और दैनिक भक्ति
- हर सुबह एक नया वचन जो आपको हिम्मत दे
- छोटा दैनिक भक्ति लेख और मनन जो आप पूरा कर सकें
- KJV, NIV और ESV में पढ़ें
- पसंदीदा वचन सेव करें और कभी भी दोबारा पढ़ें

रोज़ की प्रार्थना और प्रार्थना अलार्म
- 365 लिखी हुई प्रार्थनाएं, शांत आवाज़ में ऑडियो के साथ
- साल के हर दिन के लिए सुबह और शाम की प्रार्थना
- प्रार्थना अलार्म आपके नियंत्रण में - सुबह और शाम की घंटी सेट करें
- रुकने, सांस लेने और परमेश्वर से बात करने की कोमल याद

विश्वास की यात्राएं
- कई दिनों की यात्राएं: चिंता, क्षमा, धन्यवाद, उद्देश्य और चंगाई
- हर दिन एक छोटा कदम - वचन, मनन और प्रार्थना
- स्ट्रीक बनाएं और परमेश्वर के साथ चलना आदत बनाएं

लॉक स्क्रीन पर परमेश्वर का वचन
- लॉक स्क्रीन और होम स्क्रीन के लिए बाइबल वचन वॉलपेपर
- सैकड़ों HD यीशु मसीह वॉलपेपर और क्रिश्चियन बैकग्राउंड
- 3D पैरालैक्स लाइव वॉलपेपर - फोन झुकाने पर क्रॉस हिलता है
- संग्रह: शांति, सामर्थ्य, आशा, चंगाई और धन्यवाद
- एक टैप में लगाएं - लॉक स्क्रीन, होम स्क्रीन या दोनों पर

विश्वास में बढ़ने के लिए और भी
- बाइबल क्विज़ - अपना बाइबल ज्ञान परखें और बढ़ाएं
- प्रार्थना और शांति के लिए एक शांत Sanctuary
- पढ़ते और प्रार्थना करते समय आराधना की मधुर ध्वनि

Prayly क्यों पसंद किया जाता है
हम रोज़ प्रार्थना करना चाहते हैं, पर रह जाता है। Prayly इसे आसान बनाता है: वचन तैयार है, प्रार्थना लिखी हुई है और याद कोमल है। फिर आपकी लॉक स्क्रीन पूरे दिन परमेश्वर का वचन सामने रखती है - याद दिलाती है कि आप प्रिय हैं, संभाले गए हैं, और कभी अकेले नहीं हैं।

मुफ़्त डाउनलोड। शुरू करने के लिए खाता ज़रूरी नहीं। ऑफ़लाइन भी चलता है।

हर दिन परमेश्वर के साथ चलें।`;

const ID_FULL = `Satu ayat Alkitab, satu doa yang dibimbing, dan satu momen tenang dengan Tuhan - setiap hari. Prayly adalah aplikasi renungan harian dan doa yang dibuat untuk menjaga hati Anda dekat dengan Kristus, bahkan di hari tersibuk.

Buka di pagi hari untuk ayat Alkitab hari ini. Berdoa dengan kata-kata yang sudah disiapkan untuk Anda. Tutup hari dengan Firman di layar kunci.

AYAT ALKITAB HARI INI & RENUNGAN HARIAN
- Ayat harian baru setiap pagi untuk menguatkan langkah Anda
- Renungan harian singkat dan refleksi yang bisa Anda selesaikan
- Baca dalam KJV, NIV, atau ESV
- Simpan ayat favorit dan buka kembali kapan saja

DOA HARIAN & ALARM DOA
- 365 doa tertulis dengan audio narasi yang tenang
- Doa pagi dan doa malam untuk setiap hari dalam setahun
- Alarm doa yang Anda kendalikan - atur lonceng doa pagi dan malam
- Pengingat lembut untuk berhenti, bernapas, dan berbicara dengan Tuhan

PERJALANAN IMAN
- Perjalanan beberapa hari: kecemasan, pengampunan, syukur, tujuan, kesembuhan
- Satu langkah singkat setiap hari - Firman, refleksi, dan doa
- Bangun streak dan jadikan langkah harian dengan Tuhan sebuah kebiasaan

FIRMAN DI LAYAR KUNCI ANDA
- Wallpaper ayat Alkitab untuk layar kunci dan layar utama
- Ratusan wallpaper Yesus HD dan background Kristen
- Live wallpaper 3D parallax - salib bergerak halus saat ponsel dimiringkan
- Koleksi: damai, kekuatan, harapan, kesembuhan, dan syukur
- Sekali sentuh untuk dipasang di layar kunci, layar utama, atau keduanya

LEBIH BANYAK UNTUK BERTUMBUH
- Kuis Alkitab untuk menguji dan menambah pengetahuan Firman
- Ruang Sanctuary yang tenang untuk berdoa dan berdiam
- Suara pujian ambient saat Anda membaca dan berdoa

MENGAPA ORANG PERCAYA MENYUKAI PRAYLY
Hampir setiap hari kita ingin berdoa tetapi terlewat. Prayly membuatnya mudah: ayatnya sudah menunggu, doanya sudah tertulis, pengingatnya lembut. Lalu layar kunci Anda menjaga Firman Tuhan tetap terlihat sepanjang hari - mengingatkan bahwa Anda dikasihi, dijaga, dan tidak pernah sendiri.

Gratis diunduh. Tidak perlu akun untuk mulai. Bisa dipakai offline.

Melangkah dengan Tuhan setiap hari.`;

const FR_FULL = `Un verset du jour, une prière guidée et un moment de paix avec Dieu - chaque jour. Prayly est une application de méditation quotidienne et de prière, pensée pour garder ton cœur près du Christ, même les jours les plus chargés.

Ouvre-la le matin pour le verset du jour. Prie avec des mots déjà écrits pour toi. Termine la journée avec la Parole sur ton écran de verrouillage.

VERSET DU JOUR ET MÉDITATION QUOTIDIENNE
- Un nouveau verset du jour chaque matin pour encourager ta marche
- Une courte méditation quotidienne et une réflexion que tu peux vraiment finir
- Lis en KJV, NIV ou ESV
- Enregistre tes versets préférés et retrouve-les quand tu veux

PRIÈRE DU JOUR ET RÉVEIL DE PRIÈRE
- 365 prières écrites avec une narration audio apaisante
- Une prière du matin et une prière du soir pour chaque jour de l'année
- Un réveil de prière que tu contrôles : une cloche le matin et le soir
- Des rappels doux pour t'arrêter, respirer et parler à Dieu

PARCOURS DE FOI
- Des parcours guidés de plusieurs jours : angoisse, pardon, gratitude, appel, guérison
- Un petit pas chaque jour : Écriture, réflexion et prière
- Construis ta série et fais de ta marche avec Dieu une habitude

LA PAROLE SUR TON ÉCRAN DE VERROUILLAGE
- Fond d'écran avec verset biblique pour l'écran de verrouillage et l'accueil
- Des centaines de fonds d'écran de Jésus en HD et d'images chrétiennes
- Fond d'écran animé 3D parallaxe - la croix bouge quand tu inclines ton téléphone
- Collections : paix, force, espérance, guérison et gratitude
- Un seul geste pour l'appliquer : verrouillage, accueil ou les deux

POUR GRANDIR ENCORE DANS LA FOI
- Un quiz biblique pour tester et enrichir ta connaissance de la Bible
- Un Sanctuaire silencieux pour prier et rester dans le calme
- Des ambiances de louange pendant que tu lis et que tu pries

POURQUOI LES CROYANTS AIMENT PRAYLY
Presque chaque jour, on veut prier et on n'y arrive pas. Prayly rend ça simple : le verset t'attend, la prière est déjà écrite, le rappel est doux. Ensuite ton écran de verrouillage garde la Parole de Dieu devant toi toute la journée - pour te rappeler que tu es aimé, gardé et jamais seul.

Téléchargement gratuit. Aucun compte nécessaire pour commencer. Fonctionne hors ligne.

Marche avec Dieu chaque jour.`;

const FIL_FULL = `Isang talata sa Bibliya, isang panalangin na may gabay, at isang tahimik na sandali kasama ang Diyos - araw-araw. Ang Prayly ay devotional at prayer app na gawa para manatiling malapit ang puso mo kay Kristo, kahit sa pinaka-abalang araw.

Buksan mo tuwing umaga para sa talata ngayong araw. Manalangin gamit ang mga salitang nakasulat na para sa iyo. Tapusin ang araw na may Salita ng Diyos sa lock screen mo.

TALATA NGAYONG ARAW AT DEVOTIONAL
- Bagong talata tuwing umaga na magpapalakas sa paglalakad mo
- Maikling devotional at pagninilay na kaya mong tapusin
- Basahin sa KJV, NIV o ESV
- I-save ang mga paboritong talata at balikan kahit kailan

PANALANGIN ARAW-ARAW AT PRAYER ALARM
- 365 nakasulat na panalangin na may kalmadong audio
- Panalangin sa umaga at panalangin sa gabi para sa bawat araw ng taon
- Prayer alarm na kontrolado mo - umaga at gabi ang kampana
- Malumanay na paalala para huminto, huminga, at makipag-usap sa Diyos

MGA JOURNEY NG PANANAMPALATAYA
- Maraming araw na journey: pangamba, pagpapatawad, pasasalamat, layunin, kagalingan
- Isang maliit na hakbang kada araw - Salita, pagninilay at panalangin
- Bumuo ng streak at gawing ugali ang paglapit sa Diyos

ANG SALITA SA LOCK SCREEN MO
- Bible verse wallpaper para sa lock screen at home screen
- Daan-daang HD wallpaper ni Jesus at Christian background
- 3D parallax live wallpaper - gumagalaw ang krus kapag inikot mo ang telepono
- Mga koleksyon: kapayapaan, lakas, pag-asa, kagalingan at pasasalamat
- Isang tap lang para ilagay sa lock screen, home screen, o pareho

MARAMI PANG PARA SA PAGLAGO
- Bible quiz para subukan at palawakin ang alam mo sa Salita
- Isang tahimik na Sanctuary para manalangin at magpakatahimik
- Banayad na worship sounds habang nagbabasa at nananalangin ka

BAKIT MAHAL NG MANANAMPALATAYA ANG PRAYLY
Halos araw-araw, gusto nating manalangin pero nalilimutan. Pinapadali ito ng Prayly: nakahanda na ang talata, nakasulat na ang panalangin, at malumanay ang paalala. Tapos, ang lock screen mo ang mag-iingat sa Salita ng Diyos sa harap mo buong araw - paalala na mahal ka, iniingatan ka, at hindi ka kailanman nag-iisa.

Libreng i-download. Hindi kailangan ng account para magsimula. Gumagana offline.

Lumakad kasama ang Diyos araw-araw.`;

const DE_FULL = `Ein Tagesvers, ein geführtes Gebet und ein stiller Moment mit Gott - jeden Tag. Prayly ist eine App für tägliche Andacht und Gebet, gemacht, um dein Herz nah bei Christus zu halten, auch an den vollsten Tagen.

Öffne sie morgens für den Bibelvers des Tages. Bete mit Worten, die schon für dich geschrieben sind. Beende den Tag mit Gottes Wort auf deinem Sperrbildschirm.

TAGESVERS & ANDACHT
- Jeden Morgen ein frischer Vers, der dir Mut macht
- Kurze Andacht und Impuls, die du wirklich zu Ende liest
- Lies in verschiedenen Bibelübersetzungen
- Speichere deine Lieblingsverse und lies sie jederzeit wieder

TÄGLICHES GEBET & GEBETSGLOCKE
- 365 geschriebene Gebete mit ruhiger Sprachbegleitung
- Morgengebet und Abendgebet für jeden Tag des Jahres
- Gebetserinnerung, die du selbst bestimmst - morgens und abends
- Sanfte Erinnerungen, kurz innezuhalten und mit Gott zu reden

GLAUBENSWEGE
- Geführte Mehrtages-Wege: Angst, Vergebung, Dankbarkeit, Berufung, Heilung
- Jeden Tag ein kleiner Schritt - Bibelvers, Impuls und Gebet
- Baue eine Serie auf und mach deinen Weg mit Gott zur Gewohnheit

GOTTES WORT AUF DEM SPERRBILDSCHIRM
- Bibelvers-Hintergrund für Sperrbildschirm und Startbildschirm
- Hunderte HD-Hintergrundbilder von Jesus und christliche Motive
- 3D-Parallax-Live-Hintergrund - das Kreuz bewegt sich sanft, wenn du dein Handy neigst
- Sammlungen für Frieden, Kraft, Hoffnung, Heilung und Dankbarkeit
- Mit einem Tipp einrichten: Sperrbildschirm, Startbildschirm oder beides

MEHR ZUM WACHSEN IM GLAUBEN
- Bibel-Quiz, um dein Bibelwissen zu testen und zu vertiefen
- Ein stiller Raum für Gebet und Ruhe
- Sanfte Worship-Klänge beim Lesen und Beten

WARUM GLÄUBIGE PRAYLY LIEBEN
Fast jeden Tag wollen wir beten und kommen nicht dazu. Prayly macht es leicht: der Vers wartet, das Gebet ist geschrieben, die Erinnerung ist sanft. Und dein Sperrbildschirm hält Gottes Wort den ganzen Tag vor dir - als Erinnerung: Du bist geliebt, du wirst gehalten, und du bist nie allein.

Kostenloser Download. Kein Konto nötig, um zu starten. Funktioniert offline.

Geh jeden Tag mit Gott.`;

const IT_FULL = `Il versetto del giorno, una preghiera guidata e un momento di pace con Dio - ogni giorno. Prayly è l'app di preghiera quotidiana e Parola di Dio che ti tiene vicino a Cristo, anche nei giorni più pieni.

Apri l'app al mattino per il versetto del giorno. Prega con parole già scritte per te. Chiudi la giornata con la Parola sullo schermo di blocco.

VERSETTO DEL GIORNO E BIBBIA
- Un nuovo versetto del giorno ogni mattina, per darti forza
- Breve meditazione quotidiana che riesci davvero a finire
- Salva i tuoi versetti preferiti e rileggili quando vuoi
- La Parola di Dio, semplice, ogni giorno

PREGHIERA DEL GIORNO E SVEGLIA DI PREGHIERA
- 365 preghiere scritte con audio narrato e calmo
- Preghiera del mattino e preghiera della sera per ogni giorno dell'anno
- Sveglia di preghiera che decidi tu: una campana al mattino e alla sera
- Promemoria delicati per fermarti, respirare e parlare con Dio

PERCORSI DI FEDE
- Percorsi guidati di più giorni: ansia, perdono, gratitudine, guarigione
- Un piccolo passo al giorno: Scrittura, riflessione e preghiera
- Crea la tua serie e trasforma la fede in abitudine quotidiana

LA PAROLA SULLO SCHERMO DI BLOCCO
- Sfondi con versetti biblici per schermo di blocco e home
- Centinaia di immagini di Gesù in HD e sfondi cristiani
- Sfondo animato 3D con effetto parallasse: la croce si muove inclinando il telefono
- Raccolte: pace, forza, speranza, guarigione e gratitudine

ANCORA DI PIÙ
- Quiz biblico per mettere alla prova la tua conoscenza della Bibbia
- Un Santuario silenzioso per pregare in pace
- Suoni di lode delicati mentre leggi e preghi

Gratis da scaricare. Nessun account richiesto. Funziona offline.

Cammina con Dio ogni giorno.`;

const PL_FULL = `Werset dnia, poprowadzona modlitwa i chwila ciszy z Bogiem - codziennie. Prayly to aplikacja z codzienną modlitwą i Słowem Bożym, która pomaga trwać blisko Jezusa nawet w najbardziej zabiegane dni.

Otwórz rano i przeczytaj werset dnia. Módl się słowami, które są już dla Ciebie napisane. Zakończ dzień ze Słowem Bożym na ekranie blokady.

WERSET DNIA I BIBLIA
- Nowy werset dnia każdego ranka, aby dodać Ci sił
- Krótkie rozważanie na dziś, które naprawdę skończysz
- Zapisuj ulubione wersety i wracaj do nich, kiedy chcesz
- Słowo Boże w prostej, codziennej formie

MODLITWA NA DZIŚ I DZWON MODLITWY
- 365 napisanych modlitw ze spokojnym lektorem
- Modlitwa poranna i wieczorna na każdy dzień roku
- Przypomnienie o modlitwie, które sam ustawiasz - rano i wieczorem
- Delikatne zaproszenie, by się zatrzymać i porozmawiać z Bogiem

DROGI WIARY
- Kilkudniowe drogi: lęk, przebaczenie, wdzięczność, uzdrowienie
- Jeden mały krok dziennie: Pismo, rozważanie i modlitwa
- Buduj serię dni i zamień wiarę w codzienny nawyk

SŁOWO BOŻE NA EKRANIE BLOKADY
- Tapety z wersetami biblijnymi na ekran blokady i ekran główny
- Setki tapet HD z Jezusem i chrześcijańskich tł
- Tapeta animowana 3D z efektem paralaksy - krzyż poruszy się, gdy przechylisz telefon
- Kolekcje: pokój, siła, nadzieja, uzdrowienie i wdzięczność

WIĘCEJ DLA WIARY
- Quiz biblijny, aby sprawdzić i poszerzyć znajomość Biblii
- Ciche Sanktuarium do modlitwy i wyciszenia
- Delikodne dźwięki uwielbienia podczas czytania i modlitwy

Darmowe pobranie. Bez konta. Działa offline.

Idź z Bogiem każdego dnia.`;

const SW_FULL = `Neno la siku, maombi yenye mwongozo, na dakika ya utulivu na Mungu - kila siku. Prayly ni app ya maombi ya kila siku na Neno la Mungu, iliyoundwa kukuweka karibu na Yesu hata katika siku zenye shughuli nyingi.

Ifungue asubuhi kwa neno la siku. Omba kwa maneno yaliyokwisha andikwa kwa ajili yako. Maliza siku na Neno la Mungu kwenye skrini yako.

NENO LA SIKU NA BIBLIA
- Neno jipya kila asubuhi kukupa nguvu
- Tafakari fupi ya kila siku ambayo unaweza kuikamilisha
- Weka mistari unayoipenda na uirudie wakati wowote
- Biblia Takatifu kwa njia rahisi, kila siku

MAOMBI YA KILA SIKU NA KENGELE YA MAOMBI
- Maombi 365 yaliyoandikwa, pamoja na sauti tulivu
- Maombi ya asubuhi na maombi ya jioni kwa kila siku ya mwaka
- Kengele ya maombi unayoiweka mwenyewe - asubuhi na jioni
- Vikumbusho vya upole kusimama, kupumua na kuzungumza na Mungu

SAFARI ZA IMANI
- Safari za siku nyingi: hofu, kusamehe, shukrani na uponyaji
- Hatua moja ndogo kila siku - Neno, tafakari na maombi
- Jenga mfululizo wa siku na ufanye imani kuwa tabia

NENO LA MUNGU KWENYE SKRINI YAKO
- Wallpaper za mistari ya Biblia kwa lock screen na home screen
- Mamia ya wallpaper za Yesu za HD na picha za Kikristo
- Wallpaper ya 3D parallax - msalaba unatikisika unapoinamisha simu
- Makusanyo: amani, nguvu, tumaini, uponyaji na shukrani

ZAIDI YA HAYO
- Maswali ya Biblia kupima na kukuza ujuzi wako
- Sehemu tulivu ya maombi na utulivu
- Sauti tulivu za kumsifu Mungu unaposoma na kuomba

Pakua bure. Hakuna akaunti inayohitajika. Inafanya kazi bila intaneti.

Tembea na Mungu kila siku.`;

/**
 * Keyword tails. Play indexes the whole full description; we were only using
 * ~2.1K of the 4000 characters. Each tail adds the long-tail phrases real
 * searchers type, written as readable sentences (not a keyword dump).
 */
const EN_TAIL = `

FIND WHAT YOU NEED TODAY
Looking for a Bible verse about anxiety, a prayer for healing, a verse for strength in hard times, a morning prayer before work, a night prayer before sleep, a verse of encouragement for a friend, or a Scripture to share on WhatsApp? Prayly gives you the verse, the prayer and a shareable Bible verse image in seconds.

FOR EVERY KIND OF BELIEVER
- New to the Bible and want a simple daily starting point
- Been walking with Jesus for years and want a quiet daily rhythm
- Busy parent, student, nurse, driver - two minutes is enough
- Want Scripture in front of you all day without opening an app

COMMON QUESTIONS
Is Prayly free? Yes - the daily verse, the daily prayer and the devotional are free. Prayly Pro unlocks live wallpapers, the full journeys and an ad-free experience.
Do I need an account? No. Open the app and start today.
Does it work offline? Yes - your daily verse, prayers and saved verses work without internet.
Which Bible translations? KJV, NIV and ESV.

Daily Bible verse. Daily prayer. Daily devotional. Bible verse wallpaper. One calm app.`;

const PT_TAIL = `

O QUE VOCÊ PROCURA HOJE
Precisa de um versículo sobre ansiedade, uma oração de cura, um salmo de força, uma oração da manhã antes do trabalho, uma oração da noite antes de dormir ou uma mensagem de Deus para enviar no WhatsApp? O Prayly entrega o versículo, a oração e uma imagem para compartilhar em segundos.

PARA TODOS
- Está começando a ler a Bíblia e quer um ponto de partida simples
- Já caminha com Jesus e quer uma rotina diária tranquila
- Pai, mãe, estudante, motorista - dois minutos já bastam
- Quer a Palavra na sua frente todo o dia

PERGUNTAS FREQUENTES
O Prayly é grátis? Sim - versículo do dia, oração do dia e devocional diário são grátis. O Prayly Pro libera papéis de parede animados, as jornadas completas e a experiência sem anúncios.
Preciso de conta? Não. Abra o app e comece hoje.
Funciona offline? Sim - versículo, orações e favoritos funcionam sem internet.

Versículo do dia. Oração diária. Devocional. Palavra de Deus todos os dias.`;

const ES_TAIL = `

LO QUE BUSCAS HOY
¿Necesitas un versículo sobre la ansiedad, una oración de sanidad, un salmo de fortaleza, una oración de la mañana antes del trabajo, una oración de la noche o una imagen cristiana para compartir por WhatsApp? Prayly te da el versículo, la oración y la imagen en segundos.

PARA TODOS
- Empiezas a leer la Biblia y quieres algo sencillo cada día
- Caminas con Jesús desde hace años y quieres una rutina tranquila
- Papá, mamá, estudiante, trabajador - dos minutos son suficientes
- Quieres la Palabra frente a ti todo el día

PREGUNTAS FRECUENTES
¿Prayly es gratis? Sí - el versículo del día, la oración diaria y el devocional son gratis. Prayly Pro desbloquea los fondos animados, los caminos completos y la experiencia sin anuncios.
¿Necesito cuenta? No. Abre la app y empieza hoy.
¿Funciona sin internet? Sí.

Versículo del día. Oración diaria. Devocional. La Palabra de Dios cada día.`;

const FR_TAIL = `

CE QUE TU CHERCHES AUJOURD'HUI
Un verset sur l'angoisse, une prière de guérison, un psaume de force, une prière du matin avant le travail, une prière du soir avant de dormir, ou une image chrétienne à partager sur WhatsApp ? Prayly te donne le verset, la prière et l'image en quelques secondes.

POUR TOUS
- Tu commences la Bible et tu veux un point de départ simple
- Tu marches avec Jésus depuis des années et tu veux un rythme calme
- Parent, étudiant, salarié - deux minutes suffisent
- Tu veux la Parole devant toi toute la journée

QUESTIONS FRÉQUENTES
Prayly est-il gratuit ? Oui - le verset du jour, la prière du jour et la méditation sont gratuits. Prayly Pro débloque les fonds animés, tous les parcours et l'app sans publicité.
Faut-il un compte ? Non.
Ça marche hors ligne ? Oui.

Verset du jour. Prière quotidienne. Méditation. La Parole de Dieu chaque jour.`;

const DE_TAIL = `

WAS DU HEUTE SUCHST
Einen Bibelvers über Angst, ein Gebet um Heilung, einen Psalm für Kraft, ein Morgengebet vor der Arbeit, ein Abendgebet vor dem Schlafen oder ein christliches Bild zum Teilen bei WhatsApp? Prayly gibt dir den Vers, das Gebet und das Bild in Sekunden.

FÜR JEDEN
- Du fängst mit der Bibel an und willst einen einfachen Start
- Du gehst schon lange mit Jesus und willst einen ruhigen Rhythmus
- Eltern, Studenten, Berufstätige - zwei Minuten genügen
- Du willst Gottes Wort den ganzen Tag vor Augen haben

HÄUFIGE FRAGEN
Ist Prayly kostenlos? Ja - Tagesvers, tägliches Gebet und Andacht sind kostenlos. Prayly Pro schaltet Live-Hintergründe, alle Glaubenswege und die werbefreie App frei.
Brauche ich ein Konto? Nein.
Funktioniert es offline? Ja.

Tagesvers. Tägliches Gebet. Andacht. Gottes Wort jeden Tag.`;

const ID_TAIL = `

YANG ANDA CARI HARI INI
Butuh ayat Alkitab tentang kecemasan, doa untuk kesembuhan, mazmur untuk kekuatan, doa pagi sebelum kerja, doa malam sebelum tidur, atau gambar Kristen untuk dibagikan di WhatsApp? Prayly memberi ayat, doa, dan gambarnya dalam hitungan detik.

UNTUK SEMUA
- Baru mulai membaca Alkitab dan ingin langkah sederhana
- Sudah lama berjalan dengan Yesus dan ingin ritme harian yang tenang
- Orang tua, pelajar, pekerja - dua menit sudah cukup
- Ingin Firman terlihat sepanjang hari

PERTANYAAN UMUM
Apakah Prayly gratis? Ya - ayat harian, doa harian, dan renungan gratis. Prayly Pro membuka live wallpaper, semua perjalanan iman, dan tanpa iklan.
Perlu akun? Tidak.
Bisa offline? Bisa.

Ayat Alkitab hari ini. Doa harian. Renungan harian. Firman Tuhan setiap hari.`;

const FIL_TAIL = `

ANG HINAHANAP MO NGAYON
Kailangan mo ng bible verse tungkol sa pangamba, panalangin para sa healing, awit ng lakas, panalangin sa umaga bago magtrabaho, dasal sa gabi bago matulog, o Christian image na maipapadala sa Messenger? Ibinibigay ng Prayly ang talata, ang panalangin at ang larawan sa loob ng ilang segundo.

PARA SA LAHAT
- Bago pa lang sa Bibliya at gusto ng simpleng simula
- Matagal nang kasama si Jesus at gusto ng tahimik na routine
- Magulang, estudyante, OFW, driver - dalawang minuto ay sapat na
- Gusto mong nakikita ang Salita ng Diyos buong araw

MGA TANONG
Libre ba ang Prayly? Oo - libre ang verse of the day, ang panalangin at ang devotional. Ang Prayly Pro ang nag-a-unlock ng live wallpaper, lahat ng journey, at walang ads.
Kailangan ba ng account? Hindi.
Gumagana offline? Oo.

Bible verse ngayong araw. Panalangin araw-araw. Devotional. Salita ng Diyos araw-araw.`;

const HI_TAIL = `

आज आप क्या खोज रहे हैं
चिंता पर बाइबल वचन, चंगाई की प्रार्थना, सामर्थ्य का भजन, काम से पहले सुबह की प्रार्थना, सोने से पहले रात की प्रार्थना, या WhatsApp पर भेजने के लिए यीशु मसीह की फोटो? Prayly आपको वचन, प्रार्थना और तस्वीर कुछ सेकंड में देता है।

हर किसी के लिए
- बाइबल पढ़ना शुरू कर रहे हैं और आसान शुरुआत चाहिए
- सालों से मसीह के साथ चल रहे हैं और शांत दिनचर्या चाहिए
- माता-पिता, विद्यार्थी, नौकरीपेशा - दो मिनट भी काफी हैं
- पूरे दिन परमेश्वर का वचन सामने रखना चाहते हैं

सामान्य सवाल
Prayly मुफ़्त है? हां - आज का वचन, रोज़ की प्रार्थना और भक्ति मुफ़्त हैं। Prayly Pro में लाइव वॉलपेपर, पूरी यात्राएं और बिना विज्ञापन का अनुभव मिलता है।
खाता ज़रूरी है? नहीं।
ऑफ़लाइन चलता है? हां।

आज का बाइबल वचन। रोज़ की प्रार्थना। दैनिक भक्ति। हर दिन परमेश्वर का वचन।`;

const IT_TAIL = `

COSA CERCHI OGGI
Un versetto sull'ansia, una preghiera di guarigione, un salmo di forza, una preghiera del mattino prima del lavoro, una preghiera della sera prima di dormire o un'immagine cristiana da inviare su WhatsApp? Prayly ti dà il versetto, la preghiera e l'immagine in pochi secondi.

PER TUTTI
- Inizi ora con la Bibbia e vuoi un punto di partenza semplice
- Cammini con Gesù da anni e vuoi un ritmo quotidiano tranquillo
- Genitori, studenti, lavoratori: due minuti bastano
- Vuoi la Parola davanti a te tutto il giorno

DOMANDE FREQUENTI
Prayly è gratis? Sì - versetto del giorno, preghiera quotidiana e meditazione sono gratis. Prayly Pro sblocca gli sfondi animati, tutti i percorsi e l'app senza pubblicità.
Serve un account? No.
Funziona offline? Sì.

Versetto del giorno. Preghiera quotidiana. Vangelo e Parola di Dio ogni giorno.`;

const PL_TAIL = `

CZEGO SZUKASZ DZISIAJ
Wersetu o lęku, modlitwy o uzdrowienie, psalmu na siłę, modlitwy porannej przed pracą, modlitwy wieczornej przed snem albo chrześcijańskiej grafiki do wysłania na WhatsApp? Prayly da Ci werset, modlitwę i obraz w kilka sekund.

DLA KAŻDEGO
- Zaczynasz czytać Biblię i chcesz prostego początku
- Idziesz z Jezusem od lat i chcesz spokojnego rytmu dnia
- Rodzice, studenci, pracujący - dwie minuty wystarczą
- Chcesz mieć Słowo Boże przed oczami cały dzień

CZĘSTE PYTANIA
Czy Prayly jest darmowe? Tak - werset dnia, codzienna modlitwa i rozważanie są darmowe. Prayly Pro odblokowuje tapety animowane, wszystkie drogi wiary i brak reklam.
Czy potrzebne jest konto? Nie.
Czy działa offline? Tak.

Werset dnia. Modlitwa na dziś. Rozważanie. Słowo Boże każdego dnia.`;

const SW_TAIL = `

UNATAFUTA NINI LEO
Unahitaji mstari wa Biblia kuhusu hofu, maombi ya uponyaji, zaburi ya nguvu, maombi ya asubuhi kabla ya kazi, maombi ya usiku kabla ya kulala, au picha ya Kikristo ya kutuma WhatsApp? Prayly hukupa mstari, maombi na picha kwa sekunde chache.

KWA KILA MTU
- Unaanza kusoma Biblia na unahitaji mwanzo rahisi
- Umetembea na Yesu kwa miaka na unataka utaratibu tulivu
- Wazazi, wanafunzi, wafanyakazi - dakika mbili zinatosha
- Unataka Neno la Mungu mbele yako siku yote

MASWALI YA KAWAIDA
Prayly ni bure? Ndiyo - neno la siku, maombi ya kila siku na tafakari ni bure. Prayly Pro inafungua wallpaper za moja, safari zote za imani, na hakuna matangazo.
Nahitaji akaunti? Hapana.
Inafanya kazi bila intaneti? Ndiyo.

Neno la siku. Maombi ya kila siku. Tafakari. Neno la Mungu kila siku.`;

export const LISTINGS: PlayListing[] = [
  // ---- English surfaces: exact-phrase "bible verse of the day" in title ----
  {
    language: 'en-US',
    title: 'Prayly: Bible Verse & Prayer',
    shortDescription: 'Verse of the day, daily devotional, prayer & Jesus Bible verse lock screen',
    fullDescription: EN_FULL + EN_TAIL,
  },
  {
    language: 'en-GB',
    title: 'Prayly: Bible Verse & Prayer',
    shortDescription: 'Verse of the day, daily devotional, prayer & Jesus Bible verse lock screen',
    fullDescription: EN_FULL + EN_TAIL,
  },
  {
    // ZA / NG / KE English traffic: prayer-led, "word for today" phrasing.
    language: 'en-ZA',
    title: 'Prayly: Word for Today, Verse',
    shortDescription: 'Word for today, verse of the day, daily prayer, devotional & Bible study app',
    fullDescription: EN_FULL + EN_TAIL,
  },
  {
    language: 'en-IN',
    title: 'Prayly: Bible Verse & Prayer',
    shortDescription: 'Bible verse of the day, daily prayer, devotional & Jesus lock screen images',
    fullDescription: EN_FULL + EN_TAIL,
  },
  {
    language: 'en-SG',
    title: 'Prayly: Bible Verse & Prayer',
    shortDescription: 'Verse of the day, daily devotional, prayer & Jesus Bible verse lock screen',
    fullDescription: EN_FULL + EN_TAIL,
  },
  {
    // hi-IN intentionally uses Hindi copy + English graphics (owner decision).
    language: 'hi-IN',
    title: 'Prayly: Hindi Bible Verse',
    shortDescription: 'आज का बाइबल वचन, रोज़ की प्रार्थना, दैनिक भक्ति और यीशु लॉक स्क्रीन वॉलपेपर',
    fullDescription: HI_FULL + HI_TAIL,
  },
  // ---- Portuguese: "versiculo do dia" 550K/mo ----
  {
    language: 'pt-BR',
    title: 'Prayly: Versículo e Devocional',
    shortDescription: 'Versículo do dia, devocional diário, oração da manhã, salmos e palavra de Deus',
    fullDescription: PT_FULL + PT_TAIL,
  },
  {
    language: 'pt-PT',
    title: 'Prayly: Versículo e Devocional',
    shortDescription: 'Versículo do dia, devocional diário, oração da manhã, salmos e palavra de Deus',
    fullDescription: PT_FULL + PT_TAIL,
  },
  // ---- Spanish ----
  {
    language: 'es-419',
    title: 'Prayly: Versículo del Día',
    shortDescription: 'Versículo del día, devocional diario, oración de la mañana, salmos y Biblia',
    fullDescription: ES_FULL + ES_TAIL,
  },
  {
    language: 'es-ES',
    title: 'Prayly: Versículo del Día',
    shortDescription: 'Versículo del día, devocional diario, oración de la mañana, salmos y Biblia',
    fullDescription: ES_FULL + ES_TAIL,
  },
  // ---- Southeast Asia ----
  {
    language: 'id',
    title: 'Prayly: Ayat Alkitab & Doa',
    shortDescription: 'Ayat Alkitab hari ini, renungan harian, doa pagi, mazmur & wallpaper Yesus',
    fullDescription: ID_FULL + ID_TAIL,
  },
  {
    language: 'fil',
    title: 'Prayly: Verse & Panalangin',
    shortDescription: 'Verse of the day, panalangin sa umaga, devotional, dasal at gospel for today',
    fullDescription: FIL_FULL + FIL_TAIL,
  },
  // ---- Europe ----
  {
    language: 'fr-FR',
    title: 'Prayly: Verset du Jour, Bible',
    shortDescription: 'Verset du jour, prière du matin, méditation quotidienne et Parole de Dieu',
    fullDescription: FR_FULL + FR_TAIL,
  },
  {
    language: 'de-DE',
    title: 'Prayly: Tagesvers & Gebet',
    shortDescription: 'Tagesvers, Morgengebet, tägliche Andacht, Psalmen und Bibelvers-Hintergrund',
    fullDescription: DE_FULL + DE_TAIL,
  },
  {
    // "vangelo del giorno" 135K/mo, KD 47 - the biggest Italian Christian query.
    language: 'it-IT',
    title: 'Prayly: Versetto del Giorno',
    shortDescription: 'Versetto del giorno, preghiera del mattino, Vangelo e Parola di Dio ogni dì',
    fullDescription: IT_FULL + IT_TAIL,
  },
  {
    language: 'pl-PL',
    title: 'Prayly: Werset Dnia, Biblia',
    shortDescription: 'Werset dnia, modlitwa poranna, Biblia i Słowo Boże na ekranie blokady',
    fullDescription: PL_FULL + PL_TAIL,
  },
  // ---- East Africa ----
  {
    language: 'sw',
    title: 'Prayly: Neno la Siku, Biblia',
    shortDescription: 'Neno la siku, maombi ya asubuhi, Biblia Takatifu na Neno la Mungu kila siku',
    fullDescription: SW_FULL + SW_TAIL,
  },
];

/** Play field limits. Returns a list of human-readable violations. */
export function validateListings(listings: PlayListing[]): string[] {
  const errors: string[] = [];
  for (const l of listings) {
    if ([...l.title].length > 30) {
      errors.push(`${l.language}: title is ${[...l.title].length} chars (max 30)`);
    }
    if ([...l.shortDescription].length > 80) {
      errors.push(`${l.language}: shortDescription is ${[...l.shortDescription].length} chars (max 80)`);
    }
    if ([...l.fullDescription].length > 4000) {
      errors.push(`${l.language}: fullDescription is ${[...l.fullDescription].length} chars (max 4000)`);
    }
  }
  return errors;
}
