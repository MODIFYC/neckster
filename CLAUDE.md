# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

Neckster는 Chrome Extension (Manifest V3)으로, 브라우저 사용 시간에 따라 3D 햄스터의 목이 점점 길어지며 거북목을 시각화한다. Three.js 기반 3D 렌더링, Chrome Alarms/Storage API를 사용한다.

## 빌드 및 실행

빌드 시스템 없음. 순수 JavaScript로 트랜스파일/번들링 불필요.

**확장 프로그램 로드:**
1. `chrome://extensions/` 접속
2. 개발자 모드 활성화
3. "압축 해제된 확장 프로그램 로드" → 프로젝트 루트 선택

**수정 후 반영:** `chrome://extensions/`에서 새로고침 버튼 클릭 (콘텐츠 스크립트는 탭도 새로고침 필요)

**디버깅:**
- Background script: `chrome://extensions/` → "서비스 워커" 클릭
- Content script: 웹 페이지 DevTools Console
- New tab: 새탭 열고 DevTools

## 코드 구조

| 파일 | 역할 |
|------|------|
| `manifest.json` | 권한(`alarms`, `storage`), 콘텐츠 스크립트 주입 설정 |
| `background.js` | 1분 주기 알람으로 `elapsedMinutes` 누적 |
| `content.js` | 모든 페이지에 3D 햄스터 오버레이 렌더링 |
| `newtab.html/js/css` | 새탭 페이지 - 햄스터 케이지 인터랙티브 씬 |
| `libs/` | Three.js, GLTFLoader (minified, 직접 포함) |
| `assets/` | hamster.glb, wheel.glb, 아이콘 |

## 아키텍처

### content.js — 목 늘이기 애니메이션
- Three.js 캔버스를 페이지 우하단에 고정 오버레이로 삽입 (`pointer-events: none`)
- GLB 모델의 골격 본(Bone)을 직접 조작: `Neck`, `Head`, `LeftUpLeg`, `RightUpLeg` 등
- 30초마다 `neckBone.scale.y += 0.1` (최대 3배 연장)
- Chrome Storage에 `necksterElapsed`를 5초마다 저장 (탭 간 지속)
- 클릭 감지: Raycaster → 햄스터 클릭 시 찌그러짐 + 하트 이모지

### newtab.js — 새탭 케이지 씬
- **이중 캔버스 구조**: 배경 캔버스(하늘/잔디/구름) + 케이지 캔버스(Three.js 3D)
- 케이지 모드 3가지: Full(100%), Left(50%), Right(50%) — `cageMode` 변수로 관리
- 바닥 평면 Raycaster로 아이템 배치 (휠, 밥그릇, 물병)
- 구름은 스프라이트로 생성, 속도 차이를 둔 패럴랙스 스크롤
- `chrome.storage.local`에 `walkBounds` 저장으로 케이지 영역 유지

### 상태 관리 (Chrome Storage)
- `elapsedMinutes`: background.js가 관리하는 장기 누적 시간
- `necksterElapsed`: content.js가 관리하는 탭별 초 단위 경과 시간
- `necksterWalkBounds`: 케이지 크기/위치 변경 시 햄스터 이동 경계값

### 3D 모델 의존성
hamster.glb의 본 이름에 의존하므로 모델 교체 시 content.js의 본 이름 탐색 로직 확인 필요:
```js
model.traverse(child => {
  if (child.isBone) { /* Neck, Head, LeftUpLeg 등 이름 매칭 */ }
});
```

## 주요 제약사항

- `libs/` 내 Three.js, GLTFLoader는 수정하지 않는다
- `manifest.json`의 `web_accessible_resources`에 새 asset 추가 시 .glb/.png 파일도 등록 필요
- content.js는 `<all_urls>`에 주입되므로 성능에 민감한 코드 지양
- Manifest V3 → background script는 Service Worker (persistent 불가, 이벤트 기반)
