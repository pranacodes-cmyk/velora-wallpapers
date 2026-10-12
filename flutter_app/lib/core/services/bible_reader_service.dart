import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

class ReaderBook {
  const ReaderBook(this.name, this.chapters, this.canonicalId);
  final String name;
  final int chapters;
  final int canonicalId;
}

class ReaderEdition {
  const ReaderEdition(this.name, this.license, this.source, this.books);
  final String name;
  final String license;
  final String source;
  final List<ReaderBook> books;
}

List<List<String>> _decodeBook(List<int> bytes) {
  final raw = jsonDecode(utf8.decode(gzip.decode(bytes))) as List<dynamic>;
  return raw.map((c) => (c as List<dynamic>).map((v) => v.toString()).toList()).toList();
}

class BibleReaderService {
  static final Map<String, List<List<String>>> _cache = {};
  static Future<ReaderEdition> edition(String lang) async {
    final raw = jsonDecode(await rootBundle.loadString('assets/bible/$lang/index.json')) as Map<String, dynamic>;
    final books = (raw['books'] as List<dynamic>).map((b) => ReaderBook(b['name'] as String, b['chapters'] as int, b['canonicalId'] as int)).toList();
    return ReaderEdition(raw['name'] as String, raw['license'] as String, raw['source'] as String, books);
  }
  static Future<List<List<String>>> book(String lang, int book) async {
    final key = '$lang:$book';
    final hit = _cache[key];
    if (hit != null) return hit;
    final data = await rootBundle.load('assets/bible/$lang/$book.json.gz');
    final result = await compute(_decodeBook, data.buffer.asUint8List(data.offsetInBytes, data.lengthInBytes));
    if (_cache.length > 3) _cache.remove(_cache.keys.first);
    _cache[key] = result;
    return result;
  }
}