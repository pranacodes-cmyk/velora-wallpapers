/// Small locale-aware formatters for the challenge (no intl locale data needed).
const _months = <String, List<String>>{
  'en': ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  'es': ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'],
  'pt': ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'],
  'fil': ['Enero', 'Pebrero', 'Marso', 'Abril', 'Mayo', 'Hunyo', 'Hulyo', 'Agosto', 'Setyembre', 'Oktubre', 'Nobyembre', 'Disyembre'],
  'hi': ['जनवरी', 'फ़रवरी', 'मार्च', 'अप्रैल', 'मई', 'जून', 'जुलाई', 'अगस्त', 'सितंबर', 'अक्तूबर', 'नवंबर', 'दिसंबर'],
  'id': ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'],
  'fr': ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'],
  'de': ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'],
};

/// "14 March" / "March 14" / "14. März" for a yyyy-MM-dd date.
String formatDayMonth(String date, String lang) {
  final p = date.split('-');
  if (p.length != 3) return date;
  final m = (int.tryParse(p[1]) ?? 1).clamp(1, 12);
  final d = int.tryParse(p[2]) ?? 1;
  final name = (_months[lang] ?? _months['en']!)[m - 1];
  return switch (lang) {
    'en' => '$name $d',
    'de' => '$d. $name',
    'es' || 'pt' => '$d de $name',
    'fil' => '$name $d',
    _ => '$d $name',
  };
}

/// "7:00 AM" (en/fil/hi) or "07:00" (24h locales) for an HH:mm string.
String formatClock(String hhmm, String lang) {
  final p = hhmm.split(':');
  final h = int.tryParse(p.first) ?? 7;
  final m = p.length > 1 ? (int.tryParse(p[1]) ?? 0) : 0;
  final mm = m.toString().padLeft(2, '0');
  if (lang == 'en' || lang == 'fil' || lang == 'hi') {
    final h12 = h % 12 == 0 ? 12 : h % 12;
    final suffix = h < 12 ? (lang == 'hi' ? 'am' : 'AM') : (lang == 'hi' ? 'pm' : 'PM');
    return '$h12:$mm $suffix';
  }
  return '${h.toString().padLeft(2, '0')}:$mm';
}
