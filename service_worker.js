chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "copy-to-clipboard") {
        navigator.clipboard
            .writeText(message.content)
            .then(() => sendResponse({ success: true }))
            .catch(() => sendResponse({ success: false }));
        return true; // Indicates an asynchronous response
    }
});
