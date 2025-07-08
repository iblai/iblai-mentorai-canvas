/* -- Modify the following for each implementation -- */

// Provider of the LTI component
let baseLmsDomain = "https://learn.iblai.app";
// let lmsCourseIdWithLTI = "course-v1:main+100+2025";
// let lmsXblockIdWithLTI =
//   "block-v1:main+100+2025+type@ibl_mentor_xblock+block@883c10dfa79547eb9bce3b4123675b13";
let courseLTIMap = {
  106: {
    lmsCourseIdWithLTI: "course-v1:main+100+2025",
    lmsXblockIdWithLTI:
      "block-v1:main+100+2025+type@ibl_mentor_xblock+block@883c10dfa79547eb9bce3b4123675b13",
    canvasItemPath: "/courses/106/modules/items/315",
  },
  110: {
    lmsCourseIdWithLTI: "course-v1:main+100+2025",
    lmsXblockIdWithLTI:
      "block-v1:main+100+2025+type@ibl_mentor_xblock+block@883c10dfa79547eb9bce3b4123675b13",
    canvasItemPath: "/courses/106/modules/items/315",
  },
};

// Consumer of the LTI component
let baseCanvasDomain = "https://ibleducation.instructure.com";
// let canvasItemPath = "/courses/106/modules/items/315";
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
  "https://assets.ibl.ai/web/mentorai.js?versionId=UXPLxzG8DMNTPN_g5z0QNA_tq7u8dr9I";

// Global variable for paths where LTI should be shown
const LTI_ALLOWED_PATHS = [
  /^\/courses\/\d+\/.*$/, // Matches any path starting with /courses/{id}/
];

// Global variable for paths where LTI should be explicitly hidden
const LTI_HIDDEN_PATHS = (canvasItemPath) => [
  new RegExp(`^${canvasItemPath}$`), // Hide in the specific Canvas item URL
];

// Function to check if current path matches any allowed pattern
function shouldShowLTI() {
  const currentPath = window.location.pathname;
  const courseId = extractCourseId();
  if (courseId && courseLTIMap.hasOwnProperty(courseId)) {
    if (
      LTI_HIDDEN_PATHS(courseLTIMap[courseId].canvasItemPath).some((pattern) =>
        pattern.test(currentPath)
      )
    ) {
      return false;
    }
    return LTI_ALLOWED_PATHS.some((pattern) => pattern.test(currentPath));
  }
  return false;
}

// Function to extract course ID from the URL
function extractCourseId() {
  const path = window.location.pathname;
  const match = path.match(/^\/courses\/(\d+)/);
  return match ? match[1] : null;
}

function loginAndLaunchLTI() {
  return new Promise((resolve, reject) => {
    const courseId = extractCourseId();
    if (!courseLTIMap.hasOwnProperty(courseId)) resolve(null);
    const canvasItemPath = courseLTIMap[courseId].canvasItemPath;
    if (canvasItemPath) {
      fetch(`${baseCanvasDomain}${canvasItemPath}`, {
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
            iframe.name = "myIframe";
            iframe.style.display = "none";
            document.body.appendChild(iframe);

            const form = document.createElement("form");
            form.method = "POST";
            form.action = "https://learn.iblai.app/lti/1p3/login/";
            form.target = "myIframe";

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

            resolve(null);
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
function toggleIframe(isMobileDevice, collapse = true) {
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
      logoButton.style.display = "block";
      logoButton.style.transform = "translateX(0)";
      logoButton.style.transition = "transform 0.3s ease-in-out";
    } else {
      iframeWrapper.style.display = "none";
    }
    if (wrapper && !isMobileDevice) {
      wrapper.style.marginRight = `${draggedWidth}px`;
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
  try {
    const data = JSON.parse(event.data);
    if (data.closeEmbed && data.collapseSidebarCopilot) {
      toggleIframe(isMobileDevice, true);
      const wrapper = document.getElementById("wrapper");
      if (wrapper) {
        wrapper.style.marginRight = "0";
      }
    }
  } catch (error) {}
}

// Function to delay execution
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function launchLTI() {
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
  if (!courseLTIMap.hasOwnProperty(courseId)) return;
  const lmsCourseIdWithLTI = courseLTIMap[courseId].lmsCourseIdWithLTI;
  const lmsXblockIdWithLTI = courseLTIMap[courseId].lmsXblockIdWithLTI;
  if (courseId && lmsCourseIdWithLTI && lmsXblockIdWithLTI) {
    fetch(
      `${baseLmsDomain}/lti/1p3/launch/${lmsCourseIdWithLTI}/${lmsXblockIdWithLTI}`,
      { credentials: "include" }
    ).then(async (response) => {
      if (response.status === 401) {
        if (errorCount < 10) {
          await loginAndLaunchLTI();
          launchLTI();
        }
        errorCount += 1;
      } else {
        const iframe = document.createElement("iframe");
        iframe.src = `${baseLmsDomain}/lti/1p3/launch/${lmsCourseIdWithLTI}/${lmsXblockIdWithLTI}`;
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
        iframeWrapper.appendChild(iframe);
        container.appendChild(iframeWrapper);

        createLogoButton(isMobileDevice);
      }
    });
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
  loadScript(iblMentorSdkUrl).then(() => {
    const iframeSelector = `iframe[src^="${baseLmsDomain}/lti"], iframe[title="mentorAI"]`;

    if (shouldShowLTI()) {
      loadCanvas();
      launchLTI();
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
