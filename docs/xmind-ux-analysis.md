# XMind UX 분석 (Phase 0) — 2026-10-23

출처 표기: [문서] 공식 블로그/도움말, [SDK] xmindltd/xmind-generator·xmind-sdk-js 소스, [관찰] app.xmind.com 직접 조작(맵 '플롯 스터디 개발자의 미래'), [조사] GitHub 후보 조사.
rea 역분석과 데스크톱 관찰은 **수행하지 못함**: 이 PC에 XMind 데스크톱이 설치되어 있지 않음(레지스트리·Program Files·Store 앱 모두 없음). rea(morluto/rea v6.7.0, MIT, Node≥22)는 Electron `resources/app.asar`를 입력으로 받는 정적 JS 분석기이므로 설치본이 생기면 `npx rea-agents analyze-javascript-application <dir>`로 가능.

## 1. 키보드·상호작용 (MVP에 그대로 복제할 것)

| 동작 | 키 | 관찰 결과 |
|---|---|---|
| 자식 추가 | Tab | 선택 토픽의 **마지막 자식**으로 "Subtopic N" 생성, 새 노드 선택됨(편집 모드 아님). 캔버스가 새 노드로 자동 스크롤 [관찰] |
| 형제 추가(뒤) | Enter | 바로 아래 형제 "Main Topic N"/"Subtopic N" 생성·선택 [관찰] |
| 형제 추가(앞) | Shift+Enter | [문서]에 있으나 웹에서 눈에 띄는 동작 없음(새 줄과 충돌 가능) → MVP는 Shift+Enter=앞 형제로 구현 |
| 편집 시작 | 아무 문자 입력 / F2 / 더블클릭 | 선택 상태에서 **타이핑하면 즉시 라벨 전체가 대체**됨(type-to-replace). F2는 기존 텍스트 유지 편집 [관찰] |
| 편집 확정 | Enter | 확정 후 노드는 선택 상태 유지, 우측 "+"(자식)·하단 "+"(형제) 핸들 표시 [관찰] |
| 편집 취소 | Esc | [관찰] |
| 삭제 | Delete | 서브트리 통째 삭제, 선택은 **이전 형제**로 이동 [관찰] |
| 접기/펼치기 | Ctrl+/ | [문서]; 웹 관찰에서는 시각 변화 미확인(자식 2개뿐이라 판별 불가) |
| 선택 이동 | ←↑↓→ | ↑↓=형제 간, ←=부모(오른쪽 가지 기준), →=첫 자식 [관찰] |
| 재부모/재정렬 | 드래그 | 노드를 다른 토픽 **사이**에 놓으면 형제로 삽입, 토픽 **위**에 놓으면 자식. 드롭 후 전체 재레이아웃, **가지 색은 인덱스 기준으로 재배정**(무지개 팔레트) [관찰] |
| 관계선 | Ctrl+Shift+L | [문서]; 웹에서 키로는 동작 안 함(Label과 키 충돌) → 툴바 메뉴 사용. MVP는 툴바 버튼 + 키 |
| 경계/요약 | Ctrl+Shift+B / 메뉴 | [문서]; MVP 범위 밖 |
| 줌 | Ctrl+= / Ctrl+- / Ctrl+0 | [문서] |
| 실행취소 | Ctrl+Z / Ctrl+Shift+Z(툴바에 undo/redo 버튼) | [관찰] |

## 2. 레이아웃·렌더링 규칙 [관찰]
- 기본 구조 "logic.right"/"map": 중심 토픽 가운데, 메인 토픽은 우측에 세로 스택(균형 모드면 좌우 분배). 자식은 부모 우측에 세로 중앙 정렬.
- 가지선: 부모 우측 중앙에서 출발, 곡선(bight)으로 자식 좌측 중앙에 연결. 메인 토픽 수준 색 = 가지 인덱스별 팔레트, 하위는 상속.
- 노드 크기 = 텍스트 폭 + 패딩(중심 44px 높이, 메인 36px, 서브 24px 근사). 라벨은 SVG `<text>`, 편집은 **opacity:0 contenteditable**(`data-vk-text-input`)로 입력을 받고 SVG에 반영.
- 전체 캔버스는 SVG(41개 svg 요소, canvas 0).

## 3. .xmind 파일 포맷 [SDK]
ZIP 안에 `content.json`, `metadata.json`, `manifest.json`, (`Thumbnails/thumbnail.png`, `resources/`).
```jsonc
// content.json = Sheet[]
[{ "id": "...", "class": "sheet", "title": "Map 1",
   "rootTopic": {
     "id": "...", "class": "topic", "title": "중심",
     "structureClass": "org.xmind.ui.map.unbalanced", // 또는 logic.right 등
     "children": { "attached": [Topic...], "summary": [Topic...], "detached": [Topic...] },
     "notes": { "plain": { "content": "..." } }, "labels": ["..."], "markers": [{"markerId": "..."}],
     "boundaries": [{ "id","class":"boundary","range":"(0,1)","title" }],
     "summaries":  [{ "id","class":"summary","range":"(0,1)","topicId" }],
     "style": {...}, "position": {"x","y"}  // detached(floating) 토픽만
   },
   "relationships": [{ "id","class":"relationship","end1Id","end2Id","title","controlPoints" }]
}]
// metadata.json: { "creator": {"name": "..."}, "dataStructureVersion": "2" }
// manifest.json: { "file-entries": { "content.json": {}, "metadata.json": {}, "resources/x.png": {} } }
```
구버전(XMind 8)은 `content.xml`(`urn:xmind:xmap:xmlns:content:2.0`, `structure-class` 속성). MVP는 ZEN(JSON) 읽기/쓰기, XML은 읽기만(후순위).

## 4. GitHub subtree 후보 비교 [조사, 2026-10-23 GitHub API]

### 4-1. 마인드맵 코어
| 후보 | ★ | 라이선스 | 최근 | 장점 | 단점 |
|---|---|---|---|---|---|
| wanglin2/mind-map (`simple-mind-map/`) | 12.9k | MIT | 2026-08 | Tab/Enter/드래그/접기/관계선/요약, **.xmind 읽기·쓰기 내장**(XML+JSON), 플러그인, undo | 타입 없는 JS, Vue 데모와 섞인 레포(라이브러리 폴더만 subtree) , DAG 모드·drawio 없음 |
| SSShooter/mind-elixir-core | 3.2k | MIT | 2026-10 | TS, 프레임워크 독립, 작음, arrows/summary, React 래퍼 쉬움 | xmind import 없음(export 패키지 2023 정체), 레이아웃 3종 |
| plait-board/drawnix (+plait) | 15k | MIT | 2026-09 | 마인드맵+플로차트 한 캔버스(우리 "freeze" 아이디어와 가장 유사) | 자체 포맷만, plait 프레임워크 결합도 높음 → 아이디어 참고 |
| jsmind / kityminder-core | 3.8k / 1.4k | BSD | 2026-05 / 2024 | 가벼움 / XMind 클론 UX | 관계선 없음 / 유지보수 중단 |
| 자체 구현 | – | – | – | 데이터 모델을 DAG 전환·drawio 메타에 맞게 설계 가능, React Flow와 단일 캔버스 | 레이아웃·키보드·드래그·undo를 처음부터 (~1.5k LOC) |

### 4-2. .xmind I/O
xmind-sdk-js(492★, write-only, Node 지향), xmind-generator(53★, write-only, 브라우저 OK), xmind-viewer(78★, archived, 파서 참고). 읽기+쓰기를 모두 갖춘 독립 라이브러리는 없음 → **자체 구현(~400 LOC, jszip)**, 읽기는 simple-mind-map `src/parse/xmind.js`(MIT) 로직 참고.

### 4-3. draw.io(mxGraphModel) 생성
전용 JS 라이브러리 ≥20★ 없음. maxGraph(1.2k★, Apache-2, TS)는 풀 렌더러라 과함. jgraph/drawio-tools(186★)로 압축 포맷 검증. → **자체 구현(~250 LOC)**.

### 4-4. DAG 캔버스
@xyflow/react(38.8k★, MIT) npm 의존성. subtree 불필요.

### 추천
- **선택지 A (추천): mind-elixir-core subtree + React Flow 단일 캔버스는 포기하고 2-캔버스 구조** — 트리 모드는 mind-elixir(검증된 XMind UX·TS), "Freeze"는 mind-elixir 데이터+좌표를 React Flow 노드로 변환. .xmind/.drawio I/O는 자체 구현.
- **선택지 B: simple-mind-map subtree** — xmind I/O까지 공짜지만 JS·Vue 색채, 번들 큼.
- **선택지 C: 전부 자체 구현(React Flow 단일 캔버스)** — 모델이 가장 깔끔하지만 UX 완성도 도달까지 시간 2~3배.

## 5. 결정 및 스모크 테스트 결과 (2026-10-23)
- **결정: simple-mind-map만 `git subtree`로 도입** (`vendor/simple-mind-map`, upstream wanglin2/mind-map `simple-mind-map/` 폴더를 split, squash). 선택 기준은 검증 비용: 트리 편집 UX·레이아웃·.xmind I/O는 상류가 검증한 코드를 그대로 쓰고, 우리가 검증할 코드는 draw.io 변환기와 Freeze 계층으로 한정한다. mind-elixir 코드는 쓰지 않고 Playwright 시나리오만 E2E 명세로 참고한다.
- 업데이트: `git subtree pull --prefix=vendor/simple-mind-map <clone> smm-split --squash` (split 브랜치는 전체 히스토리 clone에서 `git subtree split --prefix=simple-mind-map` 로 생성).
- Vite 스모크 테스트(localhost:5174): Tab=자식, 타이핑=편집, Enter=확정, Enter=형제 생성 모두 동작. `mindMap.renderer.root`에서 노드별 left/top/width/height를 바로 읽을 수 있음 → Freeze·draw.io 변환의 입력.
- XMind와 다른 점(옵션으로 조정): 기본 텍스트가 중국어(`defaultInsertSecondLevelNodeText` 등으로 교체), Enter로 만든 형제가 즉시 편집 모드로 진입(XMind는 선택만). 후자는 상류 동작 유지.
