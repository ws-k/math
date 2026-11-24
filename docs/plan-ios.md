# 수학 다시 쌓기: iOS 앱(TestFlight·App Store) 전환 계획

## 무엇을 하려는가

지금의 웹앱을 고치지 않고 그대로 담아 보여 주는 얇은 iOS 껍데기 앱을 만든다. 새 외부 의존성은 0개이고, 우리가 하는 범위는 시뮬레이터에서 켜지고 기록이 남는 것까지다. 계정·서명·TestFlight 업로드는 PM 몫으로 둔다.

## 코드에서 확인한 사실

- **빌드 결과물**: `npm run build` 는 검산(약 2분) 뒤 `node scripts/build.mjs` 를 돌려 `/Users/woosoo/projects/Math/dist` 를 만든다. 내용은 `index.html`, `main.js`, `main.css`, `fonts/` 60개, `manifest.webmanifest` 로 약 2.1MB다.
- **경로**: 모든 경로가 `./` 상대 경로이고 ES 모듈이다. 그래서 `file://` 로는 못 열고 자체 주소 방식이 필요하다.
- **오래된 dist**: 지금 dist 는 11월 14일 것이다. 앱에 옛 dist 가 실리는 위험이 실제로 있다.
- **저장**: IndexedDB 하나만 쓴다(`/Users/woosoo/projects/Math/src/app/store.ts` , DB `math-rebuild`, 저장칸 `kv`). localStorage 는 안 쓴다.
- **저장 길목**: 모든 읽기·쓰기가 `RawStore`(메서드 5개)를 거친다. 저장 값에 특수 자료형은 안 보여서 JSON 왕복이 될 것으로 보이지만 테스트로 확인해야 한다.
- **외부 통신**: `src` (생성기 폴더 제외)에 외부 주소, `fetch`, `alert`, `confirm`, 파일 내려받기가 없다. 완전 오프라인 앱이고 확인 창도 자체 부품(`Confirm.tsx`)이다.
- **화면 대응**: 안전 영역(`env(safe-area-inset-*)`), `100dvh`, `viewport-fit=cover`, `user-scalable=no` 가 이미 들어 있다. 글자 선택 끄기는 문제 화면(`.pscreen`)과 일부 부품에만 걸려 있고, `.pcard` 는 일부러 선택을 허용한다.
- **설정 화면 문구**: `/Users/woosoo/projects/Math/src/app/Screens.tsx` 515행의 "홈 화면에 추가해서 열면 허용될 수 있어요"는 앱에서는 틀린 안내가 된다.
- **도구**: Xcode 27.2, Swift 6.4.2, `sips` 가 있다. xcodegen·tuist 는 없다. idb 는 `~/.local/idb-venv/bin/idb` 에 있다(PATH 밖).
- **서명 인증서**: 이 맥에 유효한 인증서가 2개 있다. 어느 팀 것인지는 보지 않았다.
- **작업 중 변경**: `src/app/App.tsx`, `Screens.tsx`, `app.css`, `today.ts` 에 커밋 안 된 변경이 있다. iOS 작업은 새 파일부터 하고, 웹 파일 수정은 그 변경이 커밋된 뒤로 미룬다.
- **저장소 공개 여부**: 원격 저장소가 공개다. 팀 ID 같은 값은 커밋하지 않는다.

## 9가지 결정

### 1. 방식: 손으로 쓴 Xcode 프로젝트

SwiftUI 앱 + WKWebView + `WKURLSchemeHandler` 로 간다. Swift 는 200~300줄 정도다.

Capacitor 를 안 쓰는 이유:
- 내부에서 하는 일이 똑같다(WKWebView + `capacitor://localhost`). 우리는 그 플러그인이 하나도 필요 없다.
- npm 의존성이 늘고(core·cli·ios와 딸린 것들) 판올림을 계속 따라가야 한다.
- 제작사는 Ionic(미국)이고 2022년 11월 OutSystems(미국 보스턴 본사)에 인수됐다. 중국산은 아니지만 비상장사라 투자자 구성까지는 확인하지 못했다.
- Capacitor 최신판 기본 틀이 UIScene 을 쓰는지는 확인하지 않았다.

SwiftUI `@main App` + `WindowGroup` 은 그 자체가 UIScene 방식이라 iOS 27 요건을 만족한다. 빌드된 Info.plist 로 다시 확인한다.

### 2. 폴더와 프로젝트 파일

```
ios/
  Math.xcodeproj/project.pbxproj     손으로 쓴 최소 파일(커밋)
  Math.xcodeproj/xcshareddata/xcschemes/Math.xcscheme
  Config/Base.xcconfig               번들 ID·버전·최소 iOS·방향(커밋)
  Config/Signing.example.xcconfig    견본(커밋)
  Config/Signing.local.xcconfig      팀 ID(gitignore)
  Config/Info.plist                  설정값으로 못 쓰는 키만(런치 화면 색)
  Math/                              MathApp.swift, WebView.swift,
                                     BundleSchemeHandler.swift,
                                     Assets.xcassets, PrivacyInfo.xcprivacy
  tools/make-icon.swift              아이콘 생성(앱에 안 들어가게 Math/ 밖)
scripts/ios.mjs                      빌드→설치→실행(기존 .mjs 관례)
```

- **pbxproj 는 손으로 써서 커밋한다.** Xcode 16+ 의 "폴더 동기화 그룹"(objectVersion 77)을 쓰면 Swift 파일을 추가해도 pbxproj 를 안 고친다. 손으로 유지할 분량이 100여 줄로 고정된다.
- **Swift 패키지 방식은 안 쓴다.** 내가 아는 한 SwiftPM 만으로는 스토어용 `.app`(Info.plist, 아이콘, 서명, Archive)을 안정적으로 만들지 못한다. 최신판에서 달라졌는지는 확인하지 않았다.
- **설정은 xcconfig 로 뺀다.** 읽기 쉬운 텍스트 파일이라 pbxproj 를 건드릴 일이 줄어든다.
- **Info.plist 와 `make-icon.swift` 는 동기화 폴더 밖에 둔다.** 안에 두면 중복 산출이나 앱에 섞여 컴파일되는 함정이 있다.
- **대비책**: Xcode 27.2 가 동기화 그룹을 거부하면 파일을 하나씩 적는 옛 형식으로 쓴다. 파일이 4~5개라 감당할 수 있다.

### 3. dist 를 앱에 싣는 법

- pbxproj 에 `../dist` 를 폴더 참조(파란 폴더)로 넣는다. 그러면 `fonts/` 하위 구조가 그대로 `Math.app/dist/` 에 복사된다.
- Xcode 빌드 단계에서 npm 을 돌리지 않는다. Xcode 환경에는 node 경로가 없고, 스크립트 샌드박스 문제가 있고, 검산 2분이 매번 붙는다.
- dist 가 없으면 Xcode 빌드가 바로 실패한다. 빈 앱이 나갈 일이 없다.
- npm 스크립트는 두 개를 둔다.
  - `ios:sim`: `node scripts/build.mjs && node scripts/ios.mjs sim`. 검산을 건너뛰는 빠른 확인용이고 빌드→설치→실행까지 한다.
  - `ios:prepare`: `npm run build && node scripts/ios.mjs check`. 스토어용이고 전체 게이트와 dist 점검을 한 뒤 커밋 해시를 출력한다.
- Xcode 산출물은 이미 gitignore 된 `.cache/ios/` 에 둔다(`-derivedDataPath`).

### 4. 저장

- **주소를 고정한다.** `app://local/index.html` 로 정하고 상수 + 주석으로 "바꾸면 기록이 안 보인다"를 남긴다. IndexedDB 는 주소(스킴+호스트)별 서랍이라서다.
- **IndexedDB 는 이 방식에서 동작할 것으로 본다.** Capacitor 가 같은 구조로 쓴다. 다만 2단계에서 실측한다.
- **`navigator.storage.persist()` 는 모른다.** 자체 스킴이 보안 컨텍스트로 취급되는지 몰라서 false 가 나올 수 있다. 2단계에서 잰다.
- **지워질 위험은 공식 문서로 배제하지 못했다.**
  - WebKit 저장 정책(iOS 17+)은 "용량 압박이나 오래 안 쓴 출처는 지울 수 있다, 영구 모드는 제외"라고만 한다.
  - Safari 의 "7일 미사용 삭제"가 앱 안 웹뷰에 적용되는지는 공식 문서에 없다. Apple 포럼 질문에도 답이 없다.
  - 적용 안 된다는 글은 블로그 수준이다.
- **추천: 앱 서류함에 사본을 둔다.**
  - IndexedDB 는 그대로 원본으로 둔다.
  - 앱에서만 `RawStore` 를 감싸 쓰기·지우기를 네이티브 파일(Application Support)에도 적는다.
  - 시작할 때 IndexedDB 가 비었고 사본이 있으면 복구한다.
  - 주소가 바뀌어도 이 사본으로 옮기면 되므로 "주소 변경 이전"도 같이 해결된다.
  - 웹(PWA) 동작은 안 바뀐다.
- **기존 PWA 기록은 자동으로 안 넘어온다.** Safari·홈 화면 앱과 네이티브 앱은 서랍이 다르다. 내보내기 기능도 지금 없다.

### 5. 입력·화면 설정

| 항목 | 설정 |
|---|---|
| 펜·터치 | 웹 코드 그대로(Safari 와 같은 엔진). 네이티브 추가 없음 |
| 안전 영역 | 웹뷰를 화면 끝까지 펴고(`ignoresSafeArea`, `contentInsetAdjustmentBehavior = .never`) 여백은 기존 CSS 가 처리 |
| 확대 | `user-scalable=no` 는 WKWebView 가 기본으로 지킴. 추가 없음 |
| 링크 미리보기·길게 누르기 메뉴 | `allowsLinkPreview = false`, 컨텍스트 메뉴 nil 반환. 화면 이동이 `<a href="#/…">` 라 필요함 |
| 글자 선택·돋보기 | 웹 CSS 그대로 두고 3단계에서 화면별로 길게 눌러 확인. 뜨는 곳만 CSS 한 줄 추가 |
| 스크롤 튕김 | 바깥 스크롤만 `bounces = false`. 안쪽 스크롤 칸은 그대로 |
| 뒤로 쓸기 | 끔(기본값). 앱의 쪽 넘김(`swipe.ts`)과 충돌 방지 |
| 상태 막대 | 보이게 두고 시스템 밝기를 따름 |
| 배경색 | 웹뷰와 런치 화면을 `#ffffff` / `#0e1117` 색 에셋으로 맞춰 흰 번쩍임 방지 |
| 방향 | 전 방향 허용, 전체 화면 강제 안 함(접힘·펼침·아이패드 크기 변화 대응) |
| 웹 프로세스 종료 | iOS 가 메모리 때문에 웹뷰를 죽이면 흰 화면이 되므로 자동 다시 불러오기 필수 |
| 외부 이동 | `app://local/` 밖은 전부 차단 |
| 디버그 | DEBUG 빌드에서만 `isInspectable = true` |

글자 선택을 `isTextInteractionEnabled = false` 로 통째로 끄지 않는 이유는 `.pcard` 의 의도된 선택 허용과 입력칸 때문이다.

### 6. 아이콘·런치 화면

- **아이콘**: `ios/tools/make-icon.swift`(CoreGraphics, 애플 기본 도구만)로 1024×1024, 투명 없음 PNG 한 장을 만든다. Xcode 의 단일 크기 아이콘이다.
- **제안 도안**: 앱 강조색 `#2559e6` 바탕에 흰 블록 3단 계단("다시 쌓기").
- **시안**: 2~3종을 `/Users/woosoo/projects/Math/outputs/ios-icon/시안.html` 로 내고 PM 이 고른다.
- **런치 화면**: 스토리보드 없이 Info.plist `UILaunchScreen` + 배경색 에셋만 쓴다.

### 7. 번들 ID·서명·역할 분담

- **번들 ID 제안**: `io.github.ws-k.math`. PM 확정이 필요하다. 첫 업로드 뒤에는 못 바꾼다.
- **표시 이름**: "수학 다시 쌓기". 홈 화면에서 잘리는지 확인한다.
- **서명**: 자동 서명으로 두고, 팀 ID 는 gitignore 된 `Signing.local.xcconfig` 에만 적는다.
- **암호화 신고**: `ITSAppUsesNonExemptEncryption = NO`. 통신·암호화가 없다.

우리가 하는 것:
- 시뮬레이터 빌드·설치·실행.
- 서명 없이 기기용 컴파일 확인.
- 스크린샷, 제출 점검표.

PM 이 하는 것:
1. Apple Developer Program 가입(연 99달러, 원화 금액은 가입 화면에서 확인).
2. Xcode > Settings > Accounts 로그인, 팀 ID 를 local 파일에 입력.
3. App Store Connect 에서 번들 ID·앱 등록.
4. `npm run ios:prepare` 뒤 Xcode 에서 Archive → Distribute → TestFlight.
5. 테스터 등록, 실기기 펜 확인.
6. 스토어 제출물: 스크린샷, 설명, 개인정보처리방침 주소, 연령 등급, 개인정보 라벨("수집 안 함").

### 8. 검증 대상과 명령

대상은 `Math - iPhone Duo`(D4D16B43-BE3A-4C00-9108-F8D251DEE16D)만 쓴다. "PS …" 시뮬레이터는 건드리지 않고 `booted` 도 쓰지 않는다.

```
xcodebuild -project ios/Math.xcodeproj -scheme Math -configuration Debug \
  -destination 'id=D4D16B43-BE3A-4C00-9108-F8D251DEE16D' -derivedDataPath .cache/ios build
xcrun simctl install D4D16B43-… .cache/ios/Build/Products/Debug-iphonesimulator/Math.app
xcrun simctl launch  D4D16B43-… <번들ID>
xcrun simctl io      D4D16B43-… screenshot outputs/ios/<이름>.png
```

- **자가 점검 모드**: DEBUG 전용으로 `simctl launch … -selfcheck` 를 둔다. 앱이 웹뷰 안에서 글꼴 로드, `isSecureContext`, `persist()` 결과, IndexedDB 쓰고 읽기, 안전 영역 값을 재서 결과 JSON 을 앱 폴더에 쓴다. 스크립트가 `simctl get_app_container` 로 읽어 통과·실패를 낸다. 새 iOS 베타 점검에도 다시 쓴다.
- **아이패드**: `Math - iPad …` 시뮬레이터를 새로 만들어 쓴다(이름 규칙).

### 9. 위험

단계별 위험은 아래 단계에, 전체 위험은 "확인이 필요한 것"에 적었다.

## 단계

### 1단계: 빈 껍데기 스파이크

가장 불확실한 전제부터 확인한다.

- **할 일**: pbxproj, xcconfig, 색만 칠한 SwiftUI 화면.
- **확인**:
  - `plutil -lint` 통과, `xcodebuild -list` 에 Math 스킴이 보인다.
  - Duo 시뮬레이터에서 켜진 채 유지된다.
  - `plutil -p Math.app/Info.plist` 에 `UIApplicationSceneManifest` 가 있다.
  - 로그에 `UIScene life cycle is required` 가 없다.
- **위험**: 손으로 쓴 pbxproj 를 Xcode 27.2 가 거부할 수 있다. 그러면 옛 형식 대비책으로 간다.

### 2단계: 웹 싣기

- **할 일**: 스킴 핸들러, dist 폴더 참조, `scripts/ios.mjs`, npm 스크립트, 자가 점검 모드.
  - 핸들러는 파일 종류(MIME)를 정확히 준다. 특히 `.js` 는 `text/javascript` 여야 한다.
  - 경로 탈출을 막고 `Cache-Control: no-store` 를 붙인다.
- **확인**:
  - 홈 화면과 수식이 있는 레슨 스크린샷. KaTeX 글꼴이 깨지지 않는다.
  - `#/map` 으로 이동된다.
  - `find Math.app/dist` 로 `fonts/` 구조가 남아 있다.
  - 기록을 쓴 뒤 ① `simctl terminate` → 다시 실행 ② 새 빌드를 덮어 설치해도 남는다.
  - 앱 폴더에서 IndexedDB 파일이 Caches 가 아닌 `Library/WebKit` 아래에 있다.
- **위험**: `persist()` 가 false 일 수 있다. 4단계의 근거가 된다.

### 3단계: 앱답게 다듬기

- **할 일**: 5번 표의 설정.
- **확인**: idb 로 직접 조작한다.
  - 링크를 길게 눌러도 미리보기가 없다.
  - 화면 끝에서 당겨도 안 튕긴다.
  - 다크 모드(`simctl ui … appearance dark`)에서 시작할 때 흰 번쩍임이 없다.
  - 접힘 382×580 에서 상태 막대와 겹치지 않는다.
  - 웹 프로세스를 강제 종료하면 자동으로 복구된다.
  - 앱을 뒤로 보냈다 돌아오면 필기가 저장돼 있다.
- **위험**: 펼친 화면 전환 방법이 미확인이다.

### 4단계: 저장 사본 (TDD)

- **할 일**:
  - `RawStore` 를 감싸는 순수 함수(기존 `app-saver.test.ts` 처럼 가짜를 주입).
  - 네이티브 파일 쓰기·읽기.
  - 시작 시 복구.
  - 설정 화면 저장 문구를 앱에서만 다르게.
- **확인**:
  - node 테스트: 쓰기·지우기 반영, 빈 DB 복구, JSON 왕복.
  - 시뮬레이터에서 `Library/WebKit` 을 지우고 실행하면 기록이 돌아온다.
- **위험**:
  - 큰 필기 데이터의 전달 속도.
  - 웹 파일 수정이 작업 중 변경과 충돌할 수 있다.

### 5단계: 아이콘·이름·개인정보 파일

- **할 일**: 아이콘 시안 → PM 선택 → 에셋 넣기, `PrivacyInfo.xcprivacy`, 버전.
- **확인**: 홈 화면 스크린샷에서 아이콘과 이름이 안 잘린다. 아이콘 PNG 에 투명이 없다(`sips -g hasAlpha`).

### 6단계: 출시 전 점검

- **할 일**:
  - `npm run ios:prepare`.
  - Release 구성 시뮬레이터 빌드.
  - `xcodebuild archive … CODE_SIGNING_ALLOWED=NO` 로 기기용 컴파일만 확인.
  - Duo 접힘·펼침과 아이패드에서 주요 화면 점검.
- **확인**: `/Users/woosoo/projects/Math/outputs/ios/점검표.html` 에 스크린샷과 통과 여부. 그 뒤 code-reviewer + verifier.

### 7단계: PM 차례

되돌리기 어려운 것은 여기서 한다.

- **할 일**: 번들 ID 확정 → 계정·서명 → TestFlight 업로드 → 실기기에서 펜(필기 지연, 손바닥, 길게 대기) 확인 → 스토어 제출물.
- **위험**: 번들 ID, 앱 이름 선점, 주소(`app://local`)는 배포 뒤에는 사실상 고정이다.

## 확인이 필요한 것

PM 결정:
- 번들 ID.
- 개인 가입인지 사업자 가입인지.
- 이 맥의 기존 인증서 2개가 쓸 팀 것인지.
- 지금 PWA 에 옮겨야 할 기록이 있는지. 있으면 내보내기·가져오기가 별도 작업이다.
- 최소 iOS. 추천은 17.0 이다(저장 정책이 바뀐 판이고, 웹 빌드 대상이 safari16 이다).
- 앱 전용 저장 문구.
- 4단계를 TestFlight 1차 전에 넣을지. 추천은 실제 기록이 쌓이기 전, 즉 1차 전이다.

실측할 것:
- 자체 스킴에서 `isSecureContext` 와 `persist()` 결과.
- 폴더 참조와 동기화 그룹이 Xcode 27.2 에서 기대대로 동작하는지.
- Duo 시뮬레이터 펼침 전환 방법. `simctl` 도움말에는 없었다.
- 폴더블 전용 Info.plist 키가 있는지.

시뮬레이터로 확인 못 하는 것:
- 펜 입력. idb 로는 손가락 터치만 넣어 봤고, 펜 주입 수단은 찾아보지 않았다. 실기기 확인이 필수다.
- 7일 이상 방치했을 때 기록이 남는지.

심사 위험:
- "웹사이트 포장 앱"(가이드라인 4.2)으로 반려될 수 있다. 오프라인 내장 콘텐츠와 펜 필기라 가능성은 낮다고 보지만 보장은 못 한다.
- 어린이 카테고리는 규칙이 많아 선택하지 않는 쪽을 권한다.

## 안 하기로 한 것

- **Capacitor·Cordova·CocoaPods·fastlane·xcodegen**: 의존성 0 원칙.
- **Xcode 빌드 중 npm 실행, CI·서버 빌드, 업로드 자동화**: API 키라는 시크릿이 필요하고 "서버에서 빌드 금지" 규칙에도 걸린다.
- **저장소를 네이티브로 통째 교체**: 사본 방식이 더 작고 되돌리기 쉽다.
- **펜 네이티브 연동(PencilKit, 더블탭), 홈 막대 제스처 지연, 다크·틴트 아이콘, Icon Composer 아이콘**: 실기기 피드백 뒤에 본다.
- **개발 서버 연결(라이브 리로드), 폰트 다이어트(woff·ttf 제거), Swift 단위 테스트 타깃**: 자가 점검 모드로 대신한다.
- **PWA → 앱 기록 이전**: 필요 여부부터 PM 확인.

Complex 급 작업이라 착수 전 critic 비평을 권한다. 특히 4단계 복구 규칙과 pbxproj 형식을 봐 달라고 하면 된다.

출처:
- [WebKit: Updates to Storage Policy](https://webkit.org/blog/14403/updates-to-storage-policy/)
- [WebKit: Tracking Prevention](https://webkit.org/tracking-prevention/)
- [Apple 포럼: IndexedDB in WebView, get deleted? (답변 없음)](https://developer.apple.com/forums/thread/750682)
- [Thinktecture 블로그(비공식 주장)](https://www.thinktecture.com/en/?p=8886)
- [OutSystems Acquires Ionic](https://www.outsystems.com/news/outsystems-acquires-ionic/)
- [SiliconANGLE 보도](https://siliconangle.com/?p=597781)
---

## 비평 반영·PM 결정 (2026-11-24)

PM 결정:
- PWA → 앱 기록 이전은 하지 않는다. 앱은 새로 시작한다.
- 저장 사본(4단계)은 **첫 TestFlight 전에** 넣는다. 비평은 뒤로 미루자고 했지만 PM 이 앞을 골랐다. 그래서 아래 C1 규칙으로 간다.

비평에서 확정한 고칠 점:
- **주소**: `app://local` 대신 고유 스킴 `mathrebuild://localhost/` 를 쓴다. 옛 스킴 핸들러를 남기면 나중에 기록을 옮길 수 있다.
- **pbxproj**:
  - `objectVersion = 77` 과 `PBXFileSystemSynchronizedRootGroup` 을 쓴다. 참고 예제는 Xcode 내장 visionOS 템플릿 pbxproj 다.
  - 설정값: `INFOPLIST_KEY_UIApplicationSceneManifest_Generation = YES`, `SWIFT_DEFAULT_ACTOR_ISOLATION = MainActor`, `developmentRegion` / `CFBundleDevelopmentRegion = ko`.
- **서명**: `Signing.local` / `example` 로 나누지 않는다. `Base.xcconfig` 에 `#include? "Signing.local.xcconfig"` 한 줄만 둔다. 팀 ID 는 비밀이 아니다.
- **스킴 핸들러**:
  - 응답은 `HTTPURLResponse`(200 + Content-Type)로 준다.
  - `start` 안에서 동기로 응답한다.
  - 경로가 밖으로 나가는 요청은 차단하고 `.js` 는 `text/javascript` 로 준다.
- **2단계 확인에 추가**: dist 를 바꾸고 다시 빌드하면 앱 안 main.js 가 바뀌는지(`cmp`).
- **3단계로 옮김·추가**:
  - 설정 화면의 "홈 화면에 추가…" 문구는 앱에서는 다르게 보이게 한다.
  - 프로필 입력에서 키보드를 올렸다 내린 뒤 화면이 제자리로 오는지 확인한다.
- **옛 dist 방지 (M2)**:
  - `npm run ios:archive` 한 명령으로 웹 빌드 → `xcodebuild archive -allowProvisioningUpdates` → Organizer 열기까지 한다.
  - 빌드 커밋 해시를 dist 에 찍어 설정 화면에 보여 준다.
- **C1, 4단계 규칙 (착수 전 필수)**:
  1. RawStore 에 `delPrefix` 를 넣고 `deleteProfileData` 가 그걸 쓰게 한다. 사본은 raw 층에서 `createSaver` 보다 먼저 감싼다.
  2. 복구는 `main.tsx` 의 render 전에 끝낸다. 앱인지는 `window.webkit?.messageHandlers` 로 감지하고 dist 는 한 벌로 둔다.
  3. 판정은 표식 키로 한다(`DEVICE_KEYS` 에 추가).
     - 표식 있음: 사본이 없거나 키 수가 다르면 IndexedDB 기준으로 통째 다시 뜬다.
     - 표식 없음 + 사본 있음: 복구한다. 이미 있는 키는 IndexedDB 가 이긴다.
     - 읽기 오류: 아무것도 하지 않는다.
  4. 키 하나에 파일 하나, 원자적 쓰기. JSON 문자열을 그대로 넘기고, IndexedDB 트랜잭션 완료 뒤에 사본을 보낸다.
  5. 마지막 사본 성공 시각을 자가 점검 결과에 넣는다.
  6. node 테스트: 범위 삭제, 첫 사본 뜨기, 읽기 오류 시 무동작, 시작 직후 쓰기와 복구의 경합.
- **심사 준비물 추가**: 지원 URL, 4.2 대비 심사 메모, 스토어 크기 스크린샷, 배포 국가(한국만이면 EU 신고 불필요).
- **Swift 쪽**: UserDefaults·파일 수정 시각 API 를 쓰지 않는다. 개인정보 파일을 최소로 두기 위해서다.
