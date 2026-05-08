// 설치 시 초기화
chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.set({ necksterElapsed: 0 });
});
