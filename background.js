chrome.runtime.onInstalled.addListener(() => {
    chrome.alarms.create('neckTimer', { periodInMinutes: 1 });
    chrome.storage.local.set({ elapsedMinutes: 0 });
});

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'neckTimer') {
        chrome.storage.local.get('elapsedMinutes', (data) => {
            chrome.storage.local.set({
                elapsedMinutes: (data.elapsedMinutes || 0) + 1
            });
        });
    }
});