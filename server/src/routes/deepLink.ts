import { Router } from "express";

const APP_SCHEME = process.env.APP_SCHEME || "kelth";

// WhatsApp only renders http(s) links as tappable; a raw `kelth://...` deep
// link shows up as plain text. These routes give the WhatsApp templates a
// real https URL to point at, which then 302s into the app's custom scheme.
const SCREENS: Record<string, string> = {
  menu: "(tabs)/menu",
  exercise: "(tabs)/exercise",
  profile: "(tabs)/profile",
};

const router = Router();

router.get("/:screen", (req, res) => {
  const path = SCREENS[req.params.screen];
  if (!path) return res.status(404).send("No encontrado");
  res.redirect(302, `${APP_SCHEME}://${path}`);
});

export default router;
