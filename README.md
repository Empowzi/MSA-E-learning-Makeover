# MSA E-learning Makeover

A userscript that gives the MSA e-learning site (Moodle) a cleaner look, adds a dark mode, and shows deadline and announcement alerts so you don't miss anything.

> Unofficial. This project is not affiliated with or endorsed by MSA University.

## Features

**Makeover**
- Colorful course cards on Dashboard and My courses, with subject icons and category filters
- Pill-style top navigation
- Dark mode (on by default, toggle with the button in the bottom-right corner, remembered between visits)
- Soft animated background

**Course pages**
- Hero banner with the course name, number of weeks, items, and upcoming deadlines
- Color-coded week sections and activity cards with emoji icons
- Live countdown chips next to due dates (🔥 less than a day, ⏰ soon, 📅 this week, and so on)
- Submission status on assignments (✅ Done, 📝 Draft, ⚠️ Not submitted)
- Zoom control, remembered between visits

**Assignment pages**
- A clear banner showing whether you have submitted, with file count and submission time

**Deadline panel**
- A ⏰ button next to the notification bell lists every pending assignment across all your courses, sorted by due date
- Opens automatically on My courses
- Press 🔄 to check again

**Pop-up alerts on any website**
- New course announcements and bell notifications appear as pop-ups on whatever site you have open, plus a system notification
- Messages containing words like *assignment*, *deadline*, *quiz*, or *exam* are highlighted as important
- Checks every 5 minutes, using only one open tab at a time

## Install

1. Install a userscript manager such as [Tampermonkey](https://www.tampermonkey.net/) or Violentmonkey.
2. Install the script from Greasy Fork: **[add your Greasy Fork link here]**
3. Log in to [e-learning.msa.edu.eg](https://e-learning.msa.edu.eg) and open **My courses** once, so the script can learn your course list.

## Privacy

- The script talks only to `e-learning.msa.edu.eg` (declared in `@connect`). Nothing is sent to any other server and there is no tracking.
- It runs on all websites only so it can show pop-up alerts wherever you are. On sites other than e-learning, it adds the pop-up box and nothing else.
- It uses your existing e-learning login session. It never sees or stores your password.
- Your course list, seen announcements, and settings are saved locally in your browser and userscript manager.
- To check whether you submitted an assignment, it opens the assignment pages in the background (the same request your browser makes when you click them).

## Menu commands

Open your userscript manager's menu on any page to find:
- **Check now**: run the notification check immediately
- **Send test notification**: preview how a pop-up looks
- **Reset (forget everything)**: clear remembered courses and seen notifications

## Troubleshooting

- **Deadline panel says to open My courses**: visit My courses once so the course list is saved.
- **No alerts**: make sure you are logged in to e-learning. If you are logged out, the script shows a reminder at most once every 6 hours.
- **Layout looks off after a Moodle update**: Moodle's page structure can change. Please open an issue.

## License

Copyright 2026 Ninoooozzzz. All rights reserved.

You may install and use this script for personal use. Copying, modifying, or republishing it without permission is not allowed.

## Contact

Found a bug or have a suggestion? Open an issue on this repository.
