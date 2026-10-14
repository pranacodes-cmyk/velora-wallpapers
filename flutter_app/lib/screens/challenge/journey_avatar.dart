import 'package:flutter/material.dart';

/// The same bundled mascot portraits and legacy wire IDs as the web app.
class JourneyAvatar extends StatelessWidget {
  const JourneyAvatar({super.key, required this.avatar, this.size = 44});
  final String avatar;
  final double size;
  static const _portraits = {
    '🐑': 'lamb', '🕊️': 'dove', '🦁': 'lion', '⭐': 'star',
    '🌊': 'whale', '🌿': 'olive', '🔥': 'lantern', '🌻': 'bear',
    '⛰️': 'turtle', '🌸': 'rabbit', '🌙': 'bird', '☀️': 'cloud',
  };
  @override
  Widget build(BuildContext context) => ClipOval(
    child: Image.asset('assets/images/journey/avatars/${_portraits[avatar] ?? 'lamb'}.webp',
      width: size, height: size, fit: BoxFit.cover, excludeFromSemantics: true),
  );
}