const statusText = document.getElementById('status-text');
const btnActivate = document.getElementById('btn-activate');
const btnDeactivate = document.getElementById('btn-deactivate');

function updateUI(granted) {
    if (granted) {
        statusText.textContent = '모든 사이트에서 활성화되어 있어요 ✓';
        statusText.className = 'status active';
        btnActivate.style.display = 'none';
        btnDeactivate.style.display = 'block';
    } else {
        statusText.textContent = '아직 활성화되지 않았어요.\n버튼을 눌러 시작하세요!';
        statusText.className = 'status';
        btnActivate.style.display = 'block';
        btnDeactivate.style.display = 'none';
    }
}

// 현재 권한 상태 확인
chrome.permissions.contains({ origins: ['<all_urls>'] }, (granted) => {
    updateUI(granted);
});

// 활성화
btnActivate.addEventListener('click', () => {
    chrome.permissions.request({ origins: ['<all_urls>'] }, (granted) => {
        updateUI(granted);
    });
});

// 비활성화
btnDeactivate.addEventListener('click', () => {
    chrome.permissions.remove({ origins: ['<all_urls>'] }, () => {
        updateUI(false);
    });
});
