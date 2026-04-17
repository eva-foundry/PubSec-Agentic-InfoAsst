import { describe, it, expect } from "vitest";
import { axe, toHaveNoViolations } from "jest-axe";
import { renderWithProviders } from "@/test/utils";
import { PublicLayout } from "@/components/PublicLayout";
import { AppShell } from "@/components/AppShell";

import Landing from "@/pages/Landing";
import Pricing from "@/pages/Pricing";
import About from "@/pages/About";
import NotFound from "@/pages/NotFound";
import Catalog from "@/pages/Catalog";
import MyWorkspace from "@/pages/MyWorkspace";
import Onboarding from "@/pages/Onboarding";
import Models from "@/pages/Models";
import Cost from "@/pages/Cost";
import AIOps from "@/pages/AIOps";
import LiveOps from "@/pages/LiveOps";
import DevOps from "@/pages/DevOps";
import Compliance from "@/pages/Compliance";
import RedTeam from "@/pages/RedTeam";
import Drift from "@/pages/Drift";
import Chat from "@/pages/Chat";

expect.extend(toHaveNoViolations);

const publicPages: [string, JSX.Element][] = [
  ["Landing", <Landing />],
  ["Pricing", <Pricing />],
  ["About", <About />],
  ["NotFound", <NotFound />],
];

const shellPages: [string, JSX.Element][] = [
  ["Catalog", <Catalog />],
  ["MyWorkspace", <MyWorkspace />],
  ["Onboarding", <Onboarding />],
  ["Models", <Models />],
  ["Cost", <Cost />],
  ["AIOps", <AIOps />],
  ["LiveOps", <LiveOps />],
  ["DevOps", <DevOps />],
  ["Compliance", <Compliance />],
  ["RedTeam", <RedTeam />],
  ["Drift", <Drift />],
  ["Chat", <Chat />],
];

// Disable rules that fire on shadcn/Radix primitives in jsdom:
// - color-contrast can't be measured in jsdom
// - landmark rules conflict with nested layout wrappers (PublicLayout/AppShell)
// - aria-valid-attr-value flags Radix's React.useId() output (":r4i:")
//   because axe doesn't recognize the colon-prefixed IDs as valid IDREFs.
const axeOptions = {
  rules: {
    "color-contrast": { enabled: false },
    "landmark-unique": { enabled: false },
    "landmark-one-main": { enabled: false },
    region: { enabled: false },
    "aria-valid-attr-value": { enabled: false },
    "heading-order": { enabled: false },
  },
};

describe("a11y: public pages", () => {
  for (const [name, el] of publicPages) {
    it(`${name} has no axe violations`, async () => {
      const { container } = renderWithProviders(<PublicLayout>{el}</PublicLayout>);
      const results = await axe(container, axeOptions);
      expect(results).toHaveNoViolations();
    }, 15000);
  }
});

describe("a11y: app shell pages", () => {
  for (const [name, el] of shellPages) {
    it(`${name} has no axe violations`, async () => {
      const { container } = renderWithProviders(<AppShell>{el}</AppShell>);
      const results = await axe(container, axeOptions);
      expect(results).toHaveNoViolations();
    }, 20000);
  }
});
