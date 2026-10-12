# Prayly Scripture editions

Texts are bundled as independently compressed books and mirrored in Flutter assets. Reader likes and reflection notes stay on the user's device; they are not public comments.

| Reader language | Edition | Scope | Rights |
| --- | --- | --- | --- |
| English | King James Version | 66 books | Public domain outside the UK; UK Crown printing rights may apply |
| Spanish | Reina-Valera 1909 | 66 books | Public domain |
| Portuguese | Almeida 1819 | 66 books | Public domain |
| Filipino | Ang Biblia 1905 | 66 books | Public domain |
| Hindi | Indian Revised Version, source updated 2019 | 66 books | CC BY-SA 4.0, © 2017–2019 Bridge Connectivity Solutions |
| Indonesian | Unlocked Literal Bible | **27 New Testament books only** | CC BY-SA 4.0, Door43 World Missions Community |
| French | Louis Segond 1910 | 66 books | Public domain |
| German | Luther 1912 | 66 books | Public domain |

Indonesian is explicitly named “Perjanjian Baru” in the reader. No copyrighted TB or non-commercial AYT text is included. Old Testament coverage remains pending a verified, commercially redistributable edition. Do not describe this edition as a complete Bible.

Each edition has its source URL and LICENSE.txt. Source license confirmations:
- Spanish: https://ebible.org/spaRV1909/copyright.htm
- Filipino: https://crosswire.org/sword/modules/ModInfo.jsp?modName=TagAngBiblia
- Hindi: https://ebible.org/hin2017/copyright.htm
- Indonesian: https://git.door43.org/STR/id_ulb/src/branch/master/LICENSE.md
- Public-domain JSON editions: https://github.com/midvash/bible-data/blob/main/SOURCES.md

USFM notes and headings are excluded, not mixed with Scripture. Intentionally omitted Indonesian manuscript verses retain their numbering but are not displayed as blank feed cards. Adapted CC BY-SA datasets remain licensed CC BY-SA 4.0 independently of app code.

Generation: `node scripts/prepare-bible-data.cjs` with downloaded source inputs under `/tmp/bible-source`. Original downloads are not app assets.

Store release is not part of this change. Flutter compilation and physical-device haptic validation remain required before release.