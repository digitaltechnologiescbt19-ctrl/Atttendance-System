import type { ReactNode } from "react";
import Sidebar from "../sidebar/Sidebar";

interface LayoutProps {
    children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
    return (
        <div className="flex h-screen">
            <Sidebar />

            <main className="flex-1 bg-slate-50 overflow-hidden">
                {children}
            </main>
        </div>
    );
}