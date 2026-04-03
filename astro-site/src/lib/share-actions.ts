import { shareContent } from "./share";

export function initShareActions() {
  const shareButtons = Array.from(document.querySelectorAll("[data-share-trigger]"));

  function setShareFeedback(button: HTMLElement, message: string, tone?: string) {
    const area = button.closest("[data-share-area]");
    const feedback = area instanceof HTMLElement ? area.querySelector("[data-share-feedback]") : null;
    if (!(feedback instanceof HTMLElement)) return;

    if (feedback.dataset.timerId) {
      window.clearTimeout(Number(feedback.dataset.timerId));
    }

    feedback.textContent = message;
    feedback.dataset.tone = tone || "neutral";

    if (!message) return;

    const timerId = window.setTimeout(() => {
      feedback.textContent = "";
      delete feedback.dataset.timerId;
    }, 2200);
    feedback.dataset.timerId = String(timerId);
  }

  shareButtons.forEach((button) => {
    if (!(button instanceof HTMLButtonElement) || button.dataset.shareBound === "true") return;
    button.dataset.shareBound = "true";

    button.addEventListener("click", async function () {
      const payload = {
        title: button.dataset.shareTitle || document.title,
        text: button.dataset.shareText || "",
        url: button.dataset.shareUrl || window.location.href,
      };

      try {
        button.disabled = true;
        setShareFeedback(button, "正在处理…", "neutral");
        const result = await shareContent(payload);
        setShareFeedback(button, result.method === "clipboard" ? "已复制链接" : "已打开分享", "success");
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        console.error("Failed to share page", error);
        setShareFeedback(button, "分享失败", "danger");
      } finally {
        button.disabled = false;
      }
    });
  });
}
