# MentorAI LTI Integration Script

This JavaScript file injects and manages a MentorAI iframe widget into Canvas, allowing seamless LTI launch from a Canvas course. It handles session validation, dynamic resizing, cookie-based state persistence, and UI interaction (such as collapsing/expanding the iframe).

## Key Features

- Dynamically injects a draggable sidebar iframe with MentorAI content.

- Automatically launches LTI sessions via POST login.

- Extracts LTI form data from the Canvas DOM.

- Handles iframe resizing and UI persistence using cookies.

- Adds a floating logo button to reopen the iframe when collapsed.

- Filters valid Canvas pages where the iframe should be injected.


## Configuration

Before using the script, override the following environment-specific variables in the script or before it loads:

| Variable             | Description                                                                                                                  |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `draggedWidth`       | Default width (in pixels) of the MentorAI sidebar iframe.                                                                    |
| `baseLmsDomain`      | LMS domain where the LTI launch URL is hosted (e.g., `https://learn.iblai.app`).                                             |
| `lmsCourseIdWithLTI` | Full course identifier for the LTI launch (e.g., `course-v1:main+100+2025`).                                                 |
| `lmsXblockIdWithLTI` | Unique xBlock identifier of the MentorAI LTI component (e.g., `block-v1:main+100+2025+type@ibl_mentor_xblock+block@abc...`). |
| `baseCanvasDomain`   | Canvas domain to fetch page data (e.g., `https://ibleducation.instructure.com`).                                             |
| `canvasItemPath`     | Path to the Canvas module item for login hint extraction (e.g., `/courses/106/modules/items/315`).                           |


Optional override:
You may also override iblMentorLogoUrl and iblMentorSdkUrl for a custom logo or IBL SDK version.


## How It Works

### 1. Canvas Page Detection

Only injects the iframe on specific course pages:

  - Allowed paths match /courses/{id}/...

  - Avoids specific paths like the current canvasItemPath.

### 2. LTI Authentication

When a session is not authenticated:

  - Fetches login hints from the canvasItemPath HTML.

  - Constructs a POST form dynamically and submits it to the LMS LTI login endpoint.

### 3. Iframe UI Behavior

The MentorAI iframe appears as a sidebar with a draggable resizer.

  - Width is saved in cookies for future visits.

  - A floating logo icon allows users to re-open the iframe when closed.

  - Listens to postMessage events to handle iframe-close requests.

## Requirements

- Canvas LMS access with LTI 1.3 support.

- Server-side support for handling the /lti/1p3/login/ and /lti/1p3/launch/ endpoints.

- Access to IBL MentorAI SDK (mentorai.js).
