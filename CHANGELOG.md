# Changelog

Notable changes in each release of 4D Ages.

## 1.0.9

**Exports fixed**
- Saving or sharing the PDF book works again. The file was being handed on before it had finished copying, so the save dialog and WhatsApp received a file that wasn't there.
- The same problem made created videos come out black and 0 seconds long. Videos now play and share properly.
- Names with symbols such as # or % no longer break the exported file.

**The birth story**
- "Welcome to the world" has a new "Tell us the whole birth story" option: twelve parts, from how it all started to a note for your little one. Answer as many as you like.
- The story is kept on the Birth story page in Classics, and has its own pages in the book after the day they were born.
- Confetti when the baby arrives and when the story is told.

**Pregnancy**
- Children who are already born (older profiles too) can now tell their pregnancy from their profile: milestones, symptoms, cravings, scans and bump photos, dated before the birth. No tips or warnings, since it's in the past.
- The book has a tick box to include or leave out the pregnancy.
- The emergency number in the symptom warnings follows the phone's country, for example 101 (Magen David Adom) in Israel, 999 in the UK and 911 in the US.

**Backup to Google Drive**
- The backup is now one small file, "4D Ages backup.zip", replaced each time. Photos and videos are no longer copied to Drive, because they're already kept in your account and come back with the books on restore.
- The folder of photo copies made by 1.0.8 is moved to the Drive bin automatically, where it can still be recovered for 30 days.

## 1.0.8

**Saving and sharing the book**
- Save PDF now uses Android's own save dialog, so the book can be saved to Downloads or Google Drive. The folder picker used before couldn't choose them ("to protect your privacy, choose another folder").
- Sharing the PDF (or a video) to WhatsApp no longer fails when Android closes the app in the background while WhatsApp is open.

**Backup to Google Drive**
- Settings, Backup: keep a copy of every book, with its photos and videos, in a "4D Ages backup" folder in your own Google Drive. When it's on, it backs up a minute after each change.
- Restore brings a backup back onto the phone, and back into your account.

**Pregnancy**
- Symptoms and Cravings have their own sections next to the pregnancy milestones, like Firsts and Lasts after the birth.
- 25 common symptoms from the NHS pregnancy pages. Each comes with tips that can help, when to call your midwife or GP, and when to get help straight away. The tips are general information, not medical advice, and they aren't saved with your notes, so they never appear in the book.
- A symptom can last a stretch of days: when it started and when it stopped, or still going.

**Sharing**
- Shorter invite messages: the code is inside the link, and WhatsApp shows a 4D Ages preview card.
- Opening an invite to a book you already have now says so, and leaves the invite unused for the person it was meant for.
- News such as "Maya's book is here" appears as an in-app notification instead of a system pop-up.

## 1.0.7

**Profiles and accounts**
- A phone can be used with more than one account. Each account's books are kept separately on the phone, and switching accounts no longer signs anyone out or risks losing changes that weren't uploaded yet.
- A child's profile can be deleted. If you created it and the other parent is in it, it's handed over to them; otherwise it's deleted with its photos. If someone else created it, it's just removed from your account.
- The profile has a clear Share button again, which opens that child's sharing screen.

**Updates**
- The app checks for a newer version when it opens and offers to download it. You can also check from Settings, About.

**Photos**
- Photos and videos keep the date they were taken, read from the file itself, instead of being dated today when the gallery doesn't pass the date on.

**Pregnancy**
- Each week's size is shown as a photo of the real fruit or vegetable instead of an emoji.

**The book**
- The book is now called "Maya's Days" until age two, then "Maya's Years", on the Book tab and the cover.
- The family page has a title that fits each theme, such as "The stars in your sky" (Little Stars) or "The birds that make you bloom" (Blossom).

**Sharing**
- Shorter invite messages that say whether the person can only view the book or can also add to it.

## 1.0.6

**Sharing, redesigned**
- Fixed: sharing a child failed every time (a database rule stopped the first parent being added), so no code could be made.
- One sharing screen for each child, from the child's profile or Settings: who can see the book, then invite **the other parent** or **a family member**.
- Short steps: who they are and whose posts they see (family), their email, a check, then send it on WhatsApp, by email, with any app, or copy it.
- Invites waiting to be accepted can be sent again or cancelled; remove, block and unblock people; join a book with a code (pasting the whole message works).
- Fixed: Settings, Who can see your children closed the app.
- Children added before this fix can now be shared too, from either version of the app.

**Pregnancy**
- Before the birth, posts and the profile show the week and the baby's size instead of an age: "Week 20 (banana)".
- Milestones are grouped by trimester (first, second, third), and the current one is marked.
- New **Gender reveal** milestone: the day you found out, and a girl, a boy or a surprise. It sets the baby's gender in the profile.
- The last milestone, **Welcome to the world**, sets the birth date, name and gender, and turns the pregnancy into the child's own profile. The pregnancy posts stay, before the birth.
- **Weekly bump photo**: a reminder each week, a card on Home and tips for photos that line up (same spot, side-on, same light). The photos play as a video of the bump growing, in Growth while pregnant and in Watch them grow after the birth. It can be turned off in Settings, Reminders.
- Gender can be chosen when adding a child (Girl, Boy or Prefer not to say). For a pregnancy, it's set at the gender reveal.
- Fixed: a pregnancy could get birthday and monthly reminders counted from its due date.

## 1.0.5

**Sharing between parents**
- Sharing works again (a half-finished first upload could block it).
- A child's code is shown first, with a link to send in WhatsApp, email or any app; the link opens the app and adds the book.
- Changes show up on the other phone within a second or two.
- A book has at most two parents. Family can be invited to view only the posts with the people you choose.
- Settings, Who can see your children: invites for one email address, remove, block and unblock.

**The keepsake book**
- Eight themes, including four new children's themes with page backgrounds (Little Stars, Blossom, Little Explorer, Rainbow Play), in several colours, chosen just before exporting.
- Fuller pages: short moments share a page, and books with a little each month get longer chapters.
- A safer PDF export: pictures are sized for print, so large books no longer run the phone out of memory. Save the PDF to the phone, or share it.
- Choose the dates, untick posts, make a book about one person, or one book for brothers and sisters.
- Classics pages (teeth, birth story, first haircut and more), and voice notes are left out of the book.

**Pregnancy**
- A due date makes a pregnancy profile: pregnancy milestones (the first kick and more), symptoms and cravings, the baby's size as a fruit week by week, ultrasound pictures and scan measurements. "The baby is here!" sets the birth date and name.

**And more**
- Health log, voice notes, hearts and comments, On this day, the monthly photo reminder.
- Growth percentiles (WHO, or CDC) with percentile lines, and head circumference.
- Forgot password, change password and email, app lock, units, light or dark mode, and dates written day first.

## 1.0.4

- Sign-in first, with Google sign-in. Settings page, a new Family page, a ready-made book in date order with print sizes and a page-by-page preview, softer milestone colours, a redesigned door frame, and many smaller fixes.

## 1.0.3

- "Continue with Google" sign-in, dark mode, and a logo in each child's colour.

## 1.0.1

- First release of the Android app.
