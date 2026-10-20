# Setup guide (about 20 minutes, once)

You need a Google account. Everything below fits Firebase's free **Spark** plan.

## 1. Create the Firebase project

1. Go to <https://console.firebase.google.com> and click **Create a project**.
2. Name it, for example `vision-toastmasters`. Google Analytics is optional (you can turn it off).

## 2. Register the web app and paste its config

1. In the project overview, click the **Web** icon (`</>`), name it `Vision TM`, and click **Register app**. Do not tick Firebase Hosting.
2. Firebase shows a `firebaseConfig = { ... }` block. Copy the values.
3. In GitHub, open `src/config.js`, click the pencil icon, replace each `PASTE_...` value, and commit.
   These values are not secret. Access is controlled by the security rules in step 4.

## 3. Turn on sign-in methods

**Build → Authentication → Get started → Sign-in method**, then enable:

| Provider | Why |
| --- | --- |
| Google | One-tap sign-in for members |
| Email/Password | For people without a Google account |
| Anonymous | Lets guests use the QR check-in form without an account |

Then open **Authentication → Settings → Authorized domains → Add domain** and add `sonusinghtomar.github.io`.

## 4. Create the database and publish the security rules

1. **Build → Firestore Database → Create database**. Choose **production mode** and the location **asia-south1 (Mumbai)**. The location cannot be changed later.
2. Open the **Rules** tab, delete everything, paste the full contents of [`firestore.rules`](../firestore.rules), and click **Publish**.
   (Or, from a computer with Node.js: `npx firebase-tools login`, then `npm run deploy:rules -- --project <your-project-id>`.)

Whenever `firestore.rules` changes in the repo, publish it again the same way.

## 5. Turn on Gemini (agenda reading and voice log)

1. **Build → AI Logic → Get started**.
2. Choose the **Gemini Developer API** (it has a free tier and needs no billing) and follow the prompts.
3. Recommended once things work: set up **App Check** with reCAPTCHA Enterprise (AI Logic → Settings), so only your app can use your Gemini quota.

The model name is set in `src/config.js` (`GEMINI_MODEL`). If Google retires that model, change it to the current "flash" model.

## 6. Publish on GitHub Pages

In the GitHub repo: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
Every push to `main` now rebuilds the app. The first deploy takes about two minutes.
The app is then live at **https://sonusinghtomar.github.io/vision-toastmasters/**.

## 7. Make yourself President (super-admin)

1. Open the app and sign in once. You will see "waiting to be linked".
2. In the Firebase console, open **Firestore Database → Data → users**, then click the document with your email.
3. Change the field `role` from `pending` to `superadmin`, and save. Reload the app.
4. In the app, go to **Members → Add member** and add yourself with your email. Then open **More → Users and access** and link your account to that member record.

From now on, you grant access inside the app:

- **Admin** (officers) manage meetings, members, guests and attendance. Only you can grant it.
- **Member** sees club data and edits their own profile, Pathways, speeches and roles.
- **Guest** sees only their own visits.

## 8. Add your members

Add each member with their **email address**. When they sign in with that email (Google, or a verified email/password account), they are linked to their profile automatically. Guests who check in by QR with an email are linked the same way if they later create an account.

You can also skip typing the roster: import a recent agenda and tap **Add as member** next to each name the app does not recognise.

---

## Costs and limits

- **Firestore, Auth (Spark plan):** free up to 50,000 reads and 20,000 writes per day. A club of 40 people uses a tiny fraction of that.
- **Gemini Developer API:** free tier with per-minute and per-day limits. That is plenty for a few agendas and voice notes a week.
- **Background push notifications:** the app reminds members of upcoming roles when they open it, offers "Add to calendar" (with a reminder the day before), and lets officers send the role list on WhatsApp in one tap. Phone push notifications while the app is closed would need Firebase Cloud Messaging plus Cloud Functions, which require the pay-as-you-go **Blaze** plan. That can be added later.

## Running it on your computer (optional)

```bash
npm install
npm run emulators      # terminal 1: local Firebase with fake data (needs Java)
npm run dev:local      # terminal 2: open the printed link
npm run test:rules     # check the security rules
```
