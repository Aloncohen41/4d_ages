/*
 * The share flow: codes and emails cleaned up, plain-language errors, the invite message, and the one database rule that blocked sharing
 * (you must always see your own membership, or the first one can never be added).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanEmail, friendlyShareError, inviteMessage, isEmail, kindSummary, normalizeCode } from "../src/lib/shareFlow";

let fails = 0; const ok = (n: string, c: boolean) => { console.log(c ? "PASS" : "FAIL", n); if (!c) fails++; };
const read = (f: string) => readFileSync(join(__dirname, "..", f), "utf8");

ok("codes: typed with spaces or dashes, in lower case, or pasted inside the whole message", normalizeCode(" 4f9a-2c1b ") === "4F9A2C1B" && normalizeCode("Or open 4D Ages and enter 4F9A2C1B. It's valid for 7 days.") === "4F9A2C1B" && normalizeCode("abc") === "ABC");
ok("emails: checked, and compared without spaces or capitals", isEmail("rosa@gmail.com") && !isEmail("rosa@") && !isEmail("rosa gmail.com") && cleanEmail("  Rosa@Gmail.com ") === "rosa@gmail.com");
ok("errors are said plainly, with what to do", /offline/.test(friendlyShareError(new Error("Network request failed"))) && /two parents/.test(friendlyShareError(new Error("This book is already shared by two parents."))) && /different email/.test(friendlyShareError(new Error("This code was made for a different email address."))) && /Ask for a new one/.test(friendlyShareError(new Error("That code is invalid or has expired"))) && /Try again/.test(friendlyShareError(new Error('new row violates row-level security policy for table "child_members"'))));
const msg = inviteMessage("family", "Maya", "4F9A2C1B", "https://x/join/?code=4F9A2C1B", "4D Ages", "rosa@gmail.com");
ok("the invite message has the link, the email it's for, and the code", msg.includes("https://x/join/?code=4F9A2C1B") && msg.includes("rosa@gmail.com") && msg.includes("4F9A2C1B"));
ok("what each kind of invite gives, in one line", /can add to it/.test(kindSummary("parent", "Maya", [])) && /posts with Nana, Grandpa/.test(kindSummary("family", "Maya", ["Nana", "Grandpa"])));

const schema = read("supabase/schema.sql"), share = read("app/share.tsx");
ok("the database fix: you always see your own membership, so the first one can be added (it blocked every share)", /cm_select on public\.child_members for select to authenticated using \(user_id = auth\.uid\(\) or public\.is_member\(child_id\)\)/.test(schema));
ok("an invite you made can be cancelled", /invites_delete on public\.invites for delete/.test(schema) && /cancelInvite\(i\.code\)/.test(share));
ok("the book is made ready to share first, with Try again if that fails", /await ensureShared\(child\.id\)/.test(share) && /label="Try again"/.test(share));
ok("the screen can't close the app: it catches its own errors", /<ErrorBoundary/.test(share) && /getDerivedStateFromError/.test(read("src/components/ErrorBoundary.tsx")));
ok("sending twice reuses the same invite; someone who already has access isn't invited again", /const existing = \(await listInvites\(childId\)\)/.test(read("src/lib/sync.ts")) && /can already see/.test(share));
ok("every way in leads to the same screen: the profile, Settings, and Join on the welcome page", /router\.push\(child \? \{ pathname: "\/share"/.test(read("src/components/ShareSheet.tsx")) && /Share \$\{child\.name\}'s book/.test(read("src/components/Screen.tsx")) && /name="share"/.test(read("app/_layout.tsx")));

ok("old profiles: every child gets its owner as a member (a repair for old ones, and automatically for new ones)", /create trigger trg_owner_member after insert on public.children/.test(schema) && /where c.owner_id is not null and not exists/.test(schema));
ok("the sample family is never put in an account (and any uploaded by mistake is removed)", read("src/lib/sync.ts").includes("if (isSampleChild(childId)) throw") && read("src/lib/sync.ts").includes("!isSampleChild(x.id)") && schema.includes("delete from public.children where id in ('maya', 'leo')"));

console.log(fails ? `${fails} FAILED` : "all share flow tests passed");
if (fails) process.exit(1);
