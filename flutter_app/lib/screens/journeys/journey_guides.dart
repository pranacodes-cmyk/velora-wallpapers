/// Port of `src/data/journeyGuides.ts` — day-guide copy (meditation,
/// reflection, breath prayer, practice) shown on the "verse"/"deeper" stages
/// of the Journey Day flow.
class JourneyDayGuide {
  const JourneyDayGuide({
    required this.meditation,
    required this.reflection,
    required this.breathPrayer,
    required this.practice,
  });
  final String meditation;
  final String reflection;
  final String breathPrayer;
  final String practice;
}

class _Fallback {
  const _Fallback(this.meditation, this.breathPrayer, this.practice);
  final String meditation;
  final String breathPrayer;
  final String practice;
}

const Map<int, JourneyDayGuide> _anxietyGuides = {
  1: JourneyDayGuide(
    meditation:
        "Notice what this verse does not do. It does not shame you for feeling anxious. It does not pretend the problem is small. It simply gives your fear a new destination. Anxiety grows when it has nowhere to go, so it circles inside your chest and calls itself preparation. Prayer breaks that circle. When you tell God the real thing — not the polished thing, the real thing — you stop being alone with it. You may still have to face the situation, but you no longer have to carry it by yourself. That is where peace begins: not when life becomes controllable, but when your heart remembers who is holding it.",
    reflection:
        "Name one worry you have been carrying like it depends completely on you. Say it plainly. No perfect words. Just tell God what is heavy.",
    breathPrayer:
        "Inhale: God is with me. Exhale: tomorrow is not mine to carry.",
    practice:
        "Before you leave, choose one worry and say: This belongs in God's hands, not in my chest.",
  ),
  2: JourneyDayGuide(
    meditation:
        "Your mind can become a room with every door open. One thought walks in, then another, then another, until fear starts acting like it owns the place. Paul says God's peace can guard your heart and your mind. Guard is a strong word. It means peace is not just a soft feeling; it is protection. You do not have to win every argument against every anxious thought. You can let God's peace stand at the door. Some thoughts can knock without being invited in. Some fears can speak without becoming your truth. Today, peace is not asking you to understand everything. Peace is asking you to let God protect the parts of you that feel exposed.",
    reflection:
        "What thought keeps walking into your mind today? Picture God placing His peace at the doorway before that thought can take over.",
    breathPrayer:
        "Inhale: Your peace guards me. Exhale: fear does not rule me.",
    practice:
        "When the thought returns today, answer it once: God is guarding my mind right now.",
  ),
  3: JourneyDayGuide(
    meditation:
        "There is a difference between placing something down and casting it. Placing it down can be gentle enough that you pick it back up five minutes later. Casting means you are done negotiating with it. Peter is not telling you to deny your anxiety; he is telling you to throw it toward the One who cares for you. That last part matters. You are not throwing your fear into an empty sky. You are casting it onto a Father who is attentive, personal, and strong enough to hold what has been crushing you. The goal today is not to feel instantly fearless. The goal is to stop treating worry like your responsibility to maintain.",
    reflection:
        "What are you tempted to pick back up after prayer? Be honest about the fear you keep returning to.",
    breathPrayer: "Inhale: You care for me. Exhale: I release this again.",
    practice:
        "Open your hand for three seconds. Let that small movement become your reminder: I have released this to God.",
  ),
  4: JourneyDayGuide(
    meditation:
        "This verse is powerful because David does not pretend. He says, when I am afraid. Not if. Not never. Faith is not the absence of fear; faith is what reaches for God while fear is still in the room. That means you are not failing because your hands shake. You are not weak because your stomach turns. Courage, in Scripture, is often fear that has found somewhere to stand. Today you do not need to manufacture confidence. You can bring God the honest sentence: I am afraid. Then add the second sentence: I put my trust in You. Both can be true. God is not offended by the first one, and He is honored by the second.",
    reflection:
        "Where do you feel afraid but still want to trust God? Hold both truths together without judging yourself.",
    breathPrayer: "Inhale: I am afraid. Exhale: I trust You anyway.",
    practice:
        "Before the next hard moment, whisper: fear is here, but God is here too.",
  ),
  5: JourneyDayGuide(
    meditation:
        "Jesus understands how quickly the mind leaves today. It runs ahead, builds imaginary rooms, rehearses imaginary pain, and returns exhausted from a future that has not happened. Matthew 6 is not telling you to be careless. It is inviting you back into the only place where grace is actually available: today. God does not give tomorrow's strength before tomorrow arrives. He gives today's bread, today's mercy, today's breath. Anxiety tries to make you live in many days at once. Jesus gently brings you back to one. This hour. This step. This breath. You are allowed to plan, but you are not required to suffer the future in advance.",
    reflection:
        "What future moment have you been emotionally living in before it arrives? Bring your attention back to this day only.",
    breathPrayer: "Inhale: grace for today. Exhale: tomorrow can wait.",
    practice:
        "Do one small present-tense thing slowly today: drink water, wash your face, step outside, breathe.",
  ),
  6: JourneyDayGuide(
    meditation:
        "The peace Jesus gives is different because it does not depend on the situation behaving. The world gives peace when the bank account is safe, the message is answered, the report is good, the house is quiet. Jesus gives peace in a locked room, on a stormy sea, beside a grave, before a cross. His peace is not fragile. It does not disappear the moment trouble enters. That means you do not have to wait until everything is fixed to receive it. You can receive peace right in the middle of what is unfinished. Let that sink in: your life can still be complicated, and your heart can still be held.",
    reflection:
        "Where have you been waiting for circumstances to change before allowing yourself peace? Invite Jesus into that exact unfinished place.",
    breathPrayer:
        "Inhale: Your peace is here. Exhale: even before it is fixed.",
    practice:
        "When stress rises today, place your hand over your chest and say: Jesus gives a different kind of peace.",
  ),
  7: JourneyDayGuide(
    meditation:
        "Peace is not a one-time achievement. It is a return. Your mind will wander after this journey. It will replay, predict, compare, and panic. That does not mean the last seven days failed. It means you are human, and humans need to come back again and again. Isaiah says God keeps in perfect peace the mind that is stayed on Him. Stayed does not mean your mind never drifts. It means when it drifts, you know where home is. You have practiced returning. You can do it in the grocery aisle, in the car, before sleep, before the call. Bring your mind back to God one more time. That is not small. That is the way peace is formed.",
    reflection:
        "What helped you return to God this week: a verse, a breath, a prayer, a moment of honesty? Keep that as your anchor.",
    breathPrayer: "Inhale: bring me back. Exhale: keep me in peace.",
    practice:
        "Choose one sentence from this week and make it your lock-screen thought for today.",
  ),
};

const Map<String, _Fallback> _journeyFallbacks = {
  'strength-hard-times': _Fallback(
    "Do not rush past the fact that you are still here. Hard seasons can make survival feel unimpressive, but heaven does not measure strength the way people do. Sometimes strength is not a loud victory; sometimes it is getting out of bed, answering the message, taking the next breath, and refusing to let pain have the final word. Let today's verse meet you there — not as pressure to become stronger instantly, but as permission to receive strength from God one moment at a time.",
    "Inhale: God strengthens me. Exhale: I only need the next step.",
    "Pick one small next step today. Not the whole mountain — just the next faithful step.",
  ),
  'healing': _Fallback(
    "Healing usually feels slower than we want. That does not mean nothing is happening. A wound can be covered and still be healing underneath. God is gentle with hidden pain, with old pain, with the places you do not know how to explain. Let today's verse speak to the part of you that has been trying to recover in silence. You do not have to perform wholeness for God. You can come as you are, and let Him touch what still hurts.",
    "Inhale: You see the wound. Exhale: Your hands are gentle.",
    "Give yourself one gentle act today: rest, water, honesty, silence, or asking for help.",
  ),
  'building-faith': _Fallback(
    "Faith is not built by pretending questions are not there. It grows when you keep turning toward God with the questions still in your hands. Let today's verse become more than information. Let it become a place to stand. You may not feel dramatic certainty, and that is okay. Faith often begins as a small yes repeated honestly: yes, I am listening; yes, I am seeking; yes, I am willing to trust You with what I cannot see yet.",
    "Inhale: I am listening. Exhale: grow my faith here.",
    "Repeat today's verse once slowly before you sleep, like planting a seed.",
  ),
  'gratitude-joy': _Fallback(
    "Gratitude does not deny pain. It trains your eyes to notice grace without pretending everything is easy. Joy often begins with attention: one breath, one gift, one kindness, one ordinary mercy you almost missed. Let today's verse interrupt the habit of only scanning for what is wrong. There is still goodness here. Not because life is perfect, but because God is present and still giving small lights in the middle of ordinary days.",
    "Inhale: this is grace. Exhale: thank You for today.",
    "Name three specific gifts today — not big, just real.",
  ),
  'loneliness': _Fallback(
    "Loneliness can lie with a very convincing voice. It tells you nobody sees, nobody would notice, nobody is close enough to understand. Today's verse answers that lie with presence. God is not observing you from far away. He is near in the quiet, near in the room, near in the ache you cannot describe. Let this moment be more than reading. Let it become companionship. You are not a forgotten person trying to reach a distant God. You are seen, known, and held right now.",
    "Inhale: You are here. Exhale: I am not forgotten.",
    "Send one honest message today, even if it is small: thinking of you, pray for me, or I miss you.",
  ),
  'grief-loss': _Fallback(
    "Grief does not move in a straight line, and nothing about that is a failure. Some hours you function, and then a song or a chair or a smell takes the ground out from under you again. God does not ask you to hurry. He came close to broken hearts, wept at a grave He was about to open, and keeps a record of tears. Let today's verse sit with you the way a friend sits in silence — not fixing, not explaining, just staying until the wave passes.",
    "Inhale: You are close. Exhale: I do not carry this alone.",
    "Say their name out loud today, and tell God one thing you are thankful for about them.",
  ),
  'money-provision': _Fallback(
    "Money fear speaks in the language of survival, which is why it gets so loud at night. But the number you keep recounting is not your security, and it never was. God has a track record with you — meals that arrived, months that somehow worked, help that came from a direction you were not watching. Let today's verse move your trust off the balance and back onto the One who has provided daily bread every single day so far.",
    "Inhale: You provide. Exhale: today is covered.",
    "Name one specific way God has already provided this month, and thank Him for it out loud.",
  ),
  'rest-sleep': _Fallback(
    "A tired mind confuses vigilance with responsibility. It replays the day and rehearses tomorrow as if staying awake were a form of control. It is not. He never slumbers, which means the watch you have been keeping in your head is not required. Let today's verse be the last thing your mind holds tonight, and let sleep become a small act of trust rather than one more thing you are failing at.",
    "Inhale: You keep watch. Exhale: I can rest now.",
    "Put the phone down early tonight and let today's verse be the last thing you read.",
  ),
};

/// Port of `getJourneyDayGuide` — exact copy for `anxiety-peace`, otherwise a
/// journey-level fallback with a per-day-title reflection line.
JourneyDayGuide getJourneyDayGuide(String journeyId, int day, String dayTitle) {
  final exact = journeyId == 'anxiety-peace' ? _anxietyGuides[day] : null;
  if (exact != null) return exact;
  final fallback =
      _journeyFallbacks[journeyId] ?? _journeyFallbacks['building-faith']!;
  return JourneyDayGuide(
    meditation: fallback.meditation,
    reflection:
        'Let "$dayTitle" become personal for a moment. Where does this touch your real life today — not in theory, but right now?',
    breathPrayer: fallback.breathPrayer,
    practice: fallback.practice,
  );
}
