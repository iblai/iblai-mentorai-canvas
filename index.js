/* -- Modify the following for each implementation -- */

// Provider of the LTI component
let baseLmsDomain = "https://learn.iblai.app";
let org = "1721338078"; // Organization slug for context API
let ltiToolId = "225";

// Consumer of the LTI component
let baseCanvasDomain = "https://ibleducation.instructure.com";
/* ----------------------------------- */

// Boilerplate standard variables (no need to modify)
let draggedWidth = 500;
let resizerWidth = 5;
let errorCount = 0;
let isIframeCollapsed = false;
let cutOffWidth = 768;
let iblMentorLogoUrl =
  "https://s3.us-east-1.amazonaws.com/iblai-app-dm-static/public-images/public/mentor/profile/mentorAI.png";
let iblMentorSdkUrl =
  "https://assets.ibl.ai/web/mentorai.js?versionId=KO5Pj8dqBvgRSjVv0xpYw0RbnpFq4kMJ";
let currentPopup = null;
let popupMessageSource = null;
let popupMessageOrigin = null;
let popupCloseWatcher = null;

// Global variable for paths where LTI should be shown
const LTI_ALLOWED_PATHS = [
  /^\/courses\/\d+\/.*$/, // Matches any path starting with /courses/{id}/
];

// Function to check if current path matches any allowed pattern
async function shouldShowLTI() {
  const currentPath = window.location.pathname;
  const courseId = extractCourseId();
  if (courseId) {
    const pathAllowed = LTI_ALLOWED_PATHS.some((pattern) =>
      pattern.test(currentPath)
    );
    if (!pathAllowed) {
      return false;
    }
    // Check context API to verify LTI is enabled for this course
    const contextEnabled = await checkLTIContextEnabled(courseId);
    return contextEnabled;
  }
  return false;
}

// Function to extract course ID from the URL
function extractCourseId() {
  const path = window.location.pathname;
  const match = path.match(/^\/courses\/(\d+)/);
  return match ? match[1] : null;
}

// Function to check if LTI is enabled for the course via context API
async function checkLTIContextEnabled(courseId) {
  try {
    const response = await fetch(
      `${baseLmsDomain}/api/mentor-xblock/orgs/${org}/context/?context_id=${encodeURIComponent(
        courseId
      )}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
    if (response.ok) {
      const data = await response.json();
      return data.enabled === true;
    }
    return false;
  } catch (error) {
    console.error("Error checking LTI context:", error);
    return false;
  }
}

function loginAndLaunchLTI() {
  return new Promise((resolve, reject) => {
    const courseId = extractCourseId();
    const canvasExternalToolItemPath = `${baseCanvasDomain}/courses/${courseId}/external_tools/${ltiToolId}/`;
    if (canvasExternalToolItemPath) {
      fetch(canvasExternalToolItemPath, {
        method: "GET",
        credentials: "include", // if authentication cookies are needed
      })
        .then(async (response) => {
          const htmlText = await response.text();
          const parser = new DOMParser();
          const doc = parser.parseFromString(htmlText, "text/html");
          const ltiMessageHint = doc.querySelector(
            'input[name="lti_message_hint"]'
          );
          const loginHint = doc.querySelector('input[name="login_hint"]');
          const clientId = doc.querySelector('input[name="client_id"]');
          const ltiDeploymentId = doc.querySelector(
            'input[name="lti_deployment_id"]'
          );
          const canvasEnvironment = doc.querySelector(
            'input[name="canvas_environment"]'
          );
          const ltiStorageTarget = doc.querySelector(
            'input[name="lti_storage_target"]'
          );
          const canvasRegion = doc.querySelector('input[name="canvas_region"]');
          const targetLinkUri = doc.querySelector(
            'input[name="target_link_uri"]'
          );
          const iss = doc.querySelector('input[name="iss"]');
          if (
            ltiMessageHint &&
            loginHint &&
            clientId &&
            ltiDeploymentId &&
            targetLinkUri &&
            canvasEnvironment &&
            canvasRegion &&
            ltiStorageTarget &&
            iss
          ) {
            const formData = new FormData();
            formData.append("lti_message_hint", ltiMessageHint.value);
            formData.append("login_hint", loginHint.value);
            formData.append("client_id", clientId.value);
            formData.append("lti_deployment_id", ltiDeploymentId.value);
            formData.append("canvas_environment", canvasEnvironment.value);
            formData.append("lti_storage_target", ltiStorageTarget.value);
            formData.append("target_link_uri", targetLinkUri.value);
            formData.append("canvas_region", canvasRegion.value);
            formData.append("iss", iss.value);

            const iframe = document.createElement("iframe");
            iframe.name = "mentorAI";
            iframe.title = "mentorAI";
            iframe.allow =
              "clipboard-read; clipboard-write; microphone *; camera *; midi *; geolocation *; encrypted-media *; display-capture *";
            // iframe.style.display = "none";
            document.body.appendChild(iframe);

            const form = document.createElement("form");
            form.method = "POST";
            form.action = `${baseLmsDomain}/lti/1p3/login/`;
            form.target = "mentorAI";

            // Loop through formData and create input elements
            for (const [key, value] of formData.entries()) {
              const input = document.createElement("input");
              input.type = "hidden";
              input.name = key;
              input.value = value;
              form.appendChild(input);
            }

            document.body.appendChild(form);
            form.submit();
            document.body.removeChild(form);
            resolve(iframe);
          } else {
            resolve(null);
          }
        })
        .catch((error) => {
          console.error("Error fetching initial page:", error);
          reject(error);
        });
    }
  });
}

function loadScript(url) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${url}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = url;
    script.async = true;
    script.onload = () => {
      resolve();
    };
    script.onerror = () => reject(new Error(`Failed to load script: ${url}`));
    document.head.appendChild(script);
  });
}

function loadCanvas() {
  // Check the window width to determine if we are on medium or small devices
  const isMediumOrSmallDevice = window.innerWidth < cutOffWidth; // Adjust the breakpoint as needed
  const wrapper = document.getElementById("wrapper");
  if (wrapper && !isMediumOrSmallDevice) {
    wrapper.style.marginRight = `${draggedWidth}px`;
  }
}

function injectSessionIframe(url) {
  return new Promise((resolve, reject) => {
    const iframe = document.createElement("iframe");

    // Style to hide it
    iframe.style.display = "none";
    iframe.src = url;

    // Set up load handler
    iframe.onload = async () => {
      // Remove iframe after load
      await delay(15000);
      iframe.remove();
      resolve();
    };

    // Error handler (might not fire for cross-origin errors)
    iframe.onerror = (e) => {
      iframe.remove();
      reject(new Error("Iframe load error"));
    };

    // Append to DOM
    document.body.appendChild(iframe);
  });
}

// Function to handle iframe collapse/expand
function toggleIframe(isMobileDevice, collapse = true, showFloatingLogo = true) {
  const iframeWrapper = document.querySelector("#mentor-ai-wrapper");
  const logoButton = document.querySelector("#mentor-ai-logo");
  const wrapper = document.getElementById("wrapper");
  if (!isMobileDevice) {
  } else {
  }
  if (collapse) {
    if (!isMobileDevice) {
      iframeWrapper.style.transform = "translateX(100%)";
      iframeWrapper.style.transition = "transform 0.3s ease-in-out";
      if (showFloatingLogo) {
        logoButton.style.display = "block";
        logoButton.style.transform = "translateX(0)";
        logoButton.style.transition = "transform 0.3s ease-in-out";
      }
    } else {
      iframeWrapper.style.display = "none";
    }
    if (wrapper && !isMobileDevice) {
      wrapper.style.marginRight = "0";
    }
  } else {
    if (!isMobileDevice) {
      iframeWrapper.style.transform = "translateX(0)";
      logoButton.style.transform = "translateX(-100%)";
      setTimeout(() => {
        logoButton.style.display = "none";
      }, 300);
    } else {
      iframeWrapper.style.display = "flex";
    }
    if (wrapper && !isMobileDevice) {
      wrapper.style.marginRight = `${draggedWidth}px`;
    }
  }

  isIframeCollapsed = collapse;
}

// Function to create crumbs logo button (prepended to .right-of-crumbs.right-of-crumbs-no-reverse)
function createCrumbsLogoButton(isMobileDevice) {
  const tryAddButton = () => {
    const crumbsContainer = document.querySelector(
      ".right-of-crumbs.right-of-crumbs-no-reverse"
    );
    if (!crumbsContainer) return false;

    // Check if button already exists
    if (document.getElementById("mentor-ai-crumbs-logo")) return true;

    const logoButton = document.createElement("div");
    logoButton.id = "mentor-ai-crumbs-logo";
    logoButton.style.cssText = `
      width: 32px;
      height: 32px;
      background: white;
      border-radius: 50%;
      box-shadow: 0 0 10px rgba(0, 0, 0, 0.2);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.3s ease-in-out;
      flex-shrink: 0;
    `;

    const logoImg = document.createElement("img");
    logoImg.src = iblMentorLogoUrl;
    logoImg.style.cssText = `
      width: 100%;
      height: 100%;
      object-fit: contain;
      border-radius: 50%;
    `;

    logoButton.appendChild(logoImg);
    logoButton.addEventListener("click", () =>
      toggleIframe(isMobileDevice, !isIframeCollapsed, false)
    );
    crumbsContainer.appendChild(logoButton);
    return true;
  };

  // Try immediately
  if (tryAddButton()) return;

  // If element not found, observe for it
  const observer = new MutationObserver((_mutationsList, obs) => {
    if (tryAddButton()) {
      obs.disconnect();
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

// Function to create logo button
function createLogoButton(isMobileDevice) {
  const logoButton = document.createElement("div");
  logoButton.id = "mentor-ai-logo";
  logoButton.style.cssText = `
position: fixed;
top: ${isMobileDevice ? "unset" : "77px"};
right: ${isMobileDevice ? "20px" : "0"};
bottom: ${isMobileDevice ? "10px" : "unset"};
width: 50px;
height: 50px;
background: white;
border-radius: 50%;
box-shadow: 0 0 10px rgba(0, 0, 0, 0.2);
cursor: pointer;
z-index: 1001;
display: ${isMobileDevice ? "block" : "none"};
transform: ${isMobileDevice ? "unset" : "translateX(100%)"};
transition: ${isMobileDevice ? "unset" : "transform 0.3s ease-in-out"};
`;

  const logoImg = document.createElement("img");
  logoImg.src = iblMentorLogoUrl;
  logoImg.style.cssText = `
width: 100%;
height: 100%;
object-fit: contain;
border-radius: 50%;
`;

  logoButton.appendChild(logoImg);
  logoButton.addEventListener("click", () =>
    toggleIframe(isMobileDevice, !isIframeCollapsed)
  );
  document.body.appendChild(logoButton);
}

// Function to handle messages from iframe
function handleIframeMessage(event) {
  const isMobileDevice = window.innerWidth < cutOffWidth;
  let data = event.data;
  try {
    data = JSON.parse(data);
  } catch {}
  if (data.closeEmbed && data.collapseSidebarCopilot) {
    toggleIframe(isMobileDevice, true);
    const wrapper = document.getElementById("wrapper");
    if (wrapper) {
      wrapper.style.marginRight = "0";
    }
  }

  // Handle ACTION:OPEN_NEW_WINDOW
  if (
    data.type === "ACTION:OPEN_NEW_WINDOW" &&
    data.payload &&
    data.payload.url
  ) {
    // Close existing popup if open
    if (currentPopup && !currentPopup.closed) {
      currentPopup.close();
    }
    // Clear existing watcher
    if (popupCloseWatcher) {
      clearInterval(popupCloseWatcher);
      popupCloseWatcher = null;
    }

    // Store the message source to send messages back
    popupMessageSource = event.source;
    popupMessageOrigin = event.origin;

    const popupWidth = 800;
    const popupHeight = 600;
    const left = (window.screen.width - popupWidth) / 2;
    const top = (window.screen.height - popupHeight) / 2;
    const popupName = `ibl_mentorai_popup_${Date.now()}`;
    currentPopup = window.open(
      data.payload.url,
      popupName,
      `width=${popupWidth},height=${popupHeight},left=${left},top=${top},toolbar=no,location=yes,directories=no,status=no,menubar=no,resizable=yes,scrollbars=yes`
    );

    // Save popup name to localStorage and ensure focus
    if (currentPopup) {
      localStorage.setItem("ibl_mentorai_popup_name", popupName);
      currentPopup.focus();

      // Watch for popup close
      popupCloseWatcher = setInterval(() => {
        if (currentPopup && currentPopup.closed) {
          clearInterval(popupCloseWatcher);
          popupCloseWatcher = null;
          currentPopup = null;
          // Notify the iframe that screensharing stopped
          if (popupMessageSource) {
            popupMessageSource.postMessage(
              { type: "MENTOR:SCREENSHARING_STOPPED" },
              popupMessageOrigin
            );
          }
        }
      }, 500);
    }
  }

  // Handle MENTOR:SCREENSHARING_STARTED from popup - forward to iframe
  if (data.type === "MENTOR:SCREENSHARING_STARTED" && event.source === currentPopup) {
    if (popupMessageSource) {
      popupMessageSource.postMessage(
        { type: "MENTOR:SCREENSHARING_STARTED" },
        popupMessageOrigin
      );
    }
  }

  // Handle MENTOR:SCREENSHARING_STOPPED from popup - close popup and forward to iframe
  if (data.type === "MENTOR:SCREENSHARING_STOPPED") {
    if (currentPopup && !currentPopup.closed) {
      currentPopup.close();
    } else {
      // Try to close popup using localStorage name reference
      const popupName = localStorage.getItem("ibl_mentorai_popup_name");
      if (popupName) {
        const existingPopup = window.open("", popupName);
        if (existingPopup && !existingPopup.closed) {
          existingPopup.close();
        }
      }
    }
    if (popupCloseWatcher) {
      clearInterval(popupCloseWatcher);
      popupCloseWatcher = null;
    }
    currentPopup = null;
    localStorage.removeItem("ibl_mentorai_popup_name");
    if (popupMessageSource) {
      popupMessageSource.postMessage(
        { type: "MENTOR:SCREENSHARING_STOPPED" },
        popupMessageOrigin
      );
    }
  }

  // Handle MENTOR:SCREENSHARING_SPEAKING from popup - forward to iframe
  if (data.type === "MENTOR:SCREENSHARING_SPEAKING" && event.source === currentPopup) {
    if (popupMessageSource) {
      popupMessageSource.postMessage(
        { type: "MENTOR:SCREENSHARING_SPEAKING", speaking: data.speaking },
        popupMessageOrigin
      );
    }
  }

  // Handle MENTOR:SCREENSHARING_MUTED - forward between popup and iframe
  if (data.type === "MENTOR:SCREENSHARING_MUTED") {
    if (event.source === currentPopup) {
      // From popup, forward to iframe
      if (popupMessageSource) {
        popupMessageSource.postMessage(
          { type: "MENTOR:SCREENSHARING_MUTED", muted: data.muted },
          popupMessageOrigin
        );
      }
    } else if (currentPopup && !currentPopup.closed) {
      // From iframe, forward to popup
      currentPopup.postMessage(
        { type: "MENTOR:SCREENSHARING_MUTED", muted: data.muted },
        "*"
      );
    }
  }

  // Handle MENTOR:SCREENSHARING_MENTOR_MUTED - forward between popup and iframe
  if (data.type === "MENTOR:SCREENSHARING_MENTOR_MUTED") {
    if (event.source === currentPopup) {
      // From popup, forward to iframe
      if (popupMessageSource) {
        popupMessageSource.postMessage(
          { type: "MENTOR:SCREENSHARING_MENTOR_MUTED", muted: data.muted },
          popupMessageOrigin
        );
      }
    } else if (currentPopup && !currentPopup.closed) {
      // From iframe, forward to popup
      currentPopup.postMessage(
        { type: "MENTOR:SCREENSHARING_MENTOR_MUTED", muted: data.muted },
        "*"
      );
    }
  }

  // Handle MENTOR:SCREENSHARING_STATUS - respond with current screensharing state
  if (data.type === "MENTOR:SCREENSHARING_STATUS") {
    let isScreensharing = false;
    if (currentPopup && !currentPopup.closed) {
      isScreensharing = true;
    } else {
      const popupName = localStorage.getItem("ibl_mentorai_popup_name");
      if (popupName) {
        const existingPopup = window.open("", popupName);
        if (existingPopup && !existingPopup.closed && existingPopup.location.href !== "about:blank") {
          isScreensharing = true;
        } else {
          localStorage.removeItem("ibl_mentorai_popup_name");
        }
      }
    }
    event.source.postMessage(
      { type: isScreensharing ? "MENTOR:SCREENSHARING_STARTED" : "MENTOR:SCREENSHARING_STOPPED" },
      event.origin
    );
  }

  // Handle ACTION:FOCUS - focus parent window (keep popup open)
  if (data.type === "ACTION:FOCUS") {
    // Blur the popup first, then focus parent window
    if (currentPopup && !currentPopup.closed) {
      currentPopup.blur();
    }
    window.focus();
  }

  // Handle MENTOR:FOCUS_PARENT - focus the parent window
  if (data.type === "MENTOR:FOCUS_PARENT") {
    window.focus();
  }
}

// Function to delay execution
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function launchLTI(iframe) {
  const container = document.getElementById("application");
  const isMobileDevice = window.innerWidth < cutOffWidth;

  const iframeWrapper = document.createElement("div");
  iframeWrapper.id = "mentor-ai-wrapper";
  iframeWrapper.style.width = isMobileDevice ? "300px" : `${draggedWidth}px`;
  iframeWrapper.style.height = isMobileDevice
    ? "calc(100vh - 196px)"
    : "calc(100vh - 77px)";
  iframeWrapper.style.position = "fixed";
  if (!isMobileDevice) {
    iframeWrapper.style.top = "77px";
    iframeWrapper.style.left = "unset";
    iframeWrapper.style.right = "0";
    iframeWrapper.style.transform = "unset";
  } else {
    iframeWrapper.style.bottom = "65px";
    iframeWrapper.style.right = "20px";
  }

  iframeWrapper.style.zIndex = "1000";
  iframeWrapper.style.boxShadow = "0 0 10px rgba(0, 0, 0, 0.2)";
  iframeWrapper.style.display = "flex";
  iframeWrapper.style.transition = "transform 0.3s ease-in-out";

  if (!isMobileDevice) {
    const wrapper = document.getElementById("wrapper");
    if (wrapper) {
      wrapper.style.marginRight = `${draggedWidth}px`;
    }
  }

  const resizer = document.createElement("div");
  resizer.style.width = `${resizerWidth}px`;
  resizer.style.cursor = "col-resize";
  resizer.style.background = "#f0f4f9";
  resizer.style.height = "100%";
  const courseId = extractCourseId();
  if (courseId) {
    iframe.style.width = `calc(100% - ${resizerWidth}px)`;
    iframe.style.height = "100%";
    iframe.style.border = "none";
    iframe.allowFullscreen = true;

    const messageHandler = handleIframeMessage;
    window.addEventListener("message", messageHandler);

    let isDragging = false;

    const stopDragging = () => {
      if (isDragging) {
        setCookie("iframeWidth", draggedWidth, 7);
      }
      isDragging = false;
      document.body.style.cursor = "";
    };

    const handleMouseMove = (e) => {
      if (!isDragging) return;
      const newWidth = window.innerWidth - e.clientX;

      if (newWidth < 300) return;
      if (newWidth > 500) return;

      draggedWidth = newWidth;
      iframeWrapper.style.width = `${draggedWidth}px`;
      const wrapper = document.getElementById("wrapper");
      if (wrapper) {
        wrapper.style.marginRight = isMobileDevice
          ? "0px"
          : `${draggedWidth}px`;
      }
    };

    const handleMouseDown = (e) => {
      isDragging = true;
      document.body.style.cursor = "col-resize";
      e.preventDefault();
    };

    resizer.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", stopDragging);
    window.addEventListener("mouseleave", stopDragging);

    iframeWrapper.appendChild(resizer);
    container.appendChild(iframeWrapper);
    iframeWrapper.appendChild(iframe);
    const courseId = extractCourseId();
    const canvasExternalToolItemPath = `${baseCanvasDomain}/courses/${courseId}/external_tools/${ltiToolId}/`;
    if (canvasExternalToolItemPath) {
      fetch(canvasExternalToolItemPath, {
        method: "GET",
        credentials: "include", // if authentication cookies are needed
      })
        .then(async (response) => {
          const htmlText = await response.text();
          const parser = new DOMParser();
          const doc = parser.parseFromString(htmlText, "text/html");
          const ltiMessageHint = doc.querySelector(
            'input[name="lti_message_hint"]'
          );
          const loginHint = doc.querySelector('input[name="login_hint"]');
          const clientId = doc.querySelector('input[name="client_id"]');
          const ltiDeploymentId = doc.querySelector(
            'input[name="lti_deployment_id"]'
          );
          const canvasEnvironment = doc.querySelector(
            'input[name="canvas_environment"]'
          );
          const ltiStorageTarget = doc.querySelector(
            'input[name="lti_storage_target"]'
          );
          const canvasRegion = doc.querySelector('input[name="canvas_region"]');
          const targetLinkUri = doc.querySelector(
            'input[name="target_link_uri"]'
          );
          const iss = doc.querySelector('input[name="iss"]');
          if (
            ltiMessageHint &&
            loginHint &&
            clientId &&
            ltiDeploymentId &&
            targetLinkUri &&
            canvasEnvironment &&
            canvasRegion &&
            ltiStorageTarget &&
            iss
          ) {
            const formData = new FormData();
            formData.append("lti_message_hint", ltiMessageHint.value);
            formData.append("login_hint", loginHint.value);
            formData.append("client_id", clientId.value);
            formData.append("lti_deployment_id", ltiDeploymentId.value);
            formData.append("canvas_environment", canvasEnvironment.value);
            formData.append("lti_storage_target", ltiStorageTarget.value);
            formData.append("target_link_uri", targetLinkUri.value);
            formData.append("canvas_region", canvasRegion.value);
            formData.append("iss", iss.value);

            // const iframe = document.createElement("iframe");
            iframe.name = "mentorAI";
            iframe.title = "mentorAI";
            // iframe.style.display = "none";
            // document.body.appendChild(iframe);

            const form = document.createElement("form");
            form.method = "POST";
            form.action = `${baseLmsDomain}/lti/1p3/login/`;
            form.target = "mentorAI";

            // Loop through formData and create input elements
            for (const [key, value] of formData.entries()) {
              const input = document.createElement("input");
              input.type = "hidden";
              input.name = key;
              input.value = value;
              form.appendChild(input);
            }

            document.body.appendChild(form);

            form.submit();
            document.body.removeChild(form);
            // resolve(iframe);
          } else {
            // resolve(null);
          }
        })
        .catch((error) => {
          console.error("Error fetching initial page:", error);
          reject(error);
        });
    }
    createLogoButton(isMobileDevice);
    createCrumbsLogoButton(isMobileDevice);
  }

  function setCookie(name, value, days) {
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = `${name}=${value}; expires=${expires}; path=/`;
  }

  function getCookie(name) {
    return document.cookie
      .split("; ")
      .find((row) => row.startsWith(name + "="))
      ?.split("=")[1];
  }
}

document.addEventListener("DOMContentLoaded", () => {
  loadScript(iblMentorSdkUrl).then(async () => {
    const iframeSelector = `iframe[src^="${baseLmsDomain}/lti"], iframe[title="mentorAI"]`;

    const showLTI = await shouldShowLTI();
    if (showLTI) {
      loadCanvas();
      const iframe = await loginAndLaunchLTI();
      if (iframe) {
        launchLTI(iframe);

        // On page refresh, check if popup is still open and notify iframe
        const popupName = localStorage.getItem("ibl_mentorai_popup_name");
        if (popupName) {
          const existingPopup = window.open("", popupName);
          if (existingPopup && !existingPopup.closed && existingPopup.location.href !== "about:blank") {
            iframe.addEventListener("load", () => {
              iframe.contentWindow.postMessage(
                { type: "MENTOR:SCREENSHARING_STARTED" },
                "*"
              );
            });
          } else {
            // Popup no longer exists, clean up
            localStorage.removeItem("ibl_mentorai_popup_name");
          }
        }
      }
    }

    function handleIframes() {
      const iframesOfInterest = document.querySelectorAll(iframeSelector);
      if (iframesOfInterest.length > 0) {
        iframesOfInterest.forEach((iframe) => {
          MentorAI.sendHTMLContentToIframe(iframe, baseLmsDomain, 5000);
        });
        return true;
      }
      return false;
    }
    const found = handleIframes();
    if (!found) {
      const observer = new MutationObserver((mutationsList, observer) => {
        for (const mutation of mutationsList) {
          if (mutation.type === "childList") {
            if (handleIframes()) {
              observer.disconnect();
            }
          }
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
      });
    }
  });
});
