import { NavLink } from "@/components/NavLink";
import { Logo } from "@/components/Logo";
import { PortalSwitcher } from "@/components/PortalSwitcher";
import { SidebarNav, SidebarFooter } from "@/components/SidebarNav";

export function AppSidebar() {
  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="px-4 py-4">
        <NavLink to="/" className="block mb-4">
          <Logo />
        </NavLink>
        <PortalSwitcher />
      </div>
      <SidebarNav />
      <SidebarFooter />
    </aside>
  );
}
