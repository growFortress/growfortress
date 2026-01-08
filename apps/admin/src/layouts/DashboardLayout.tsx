import { ComponentChildren } from 'preact';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/ui/Button';

interface DashboardLayoutProps {
    children: ComponentChildren;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
    const { logout } = useAuth();

    return (
        <div class="h-screen flex flex-col">
            <header class="bg-gray-800 text-white p-4 flex justify-between items-center">
                <h1 class="text-xl font-bold">Arcade Admin</h1>
                <nav class="space-x-4">
                    <a href="/" class="hover:text-gray-300">Dashboard</a>
                    <a href="/players" class="hover:text-gray-300">Players</a>
                    <a href="/events" class="hover:text-gray-300">Events</a>
                    <a href="/rewards" class="hover:text-gray-300">Bulk Rewards</a>
                    <a href="/bug-reports" class="hover:text-gray-300">Bug Reports</a>
                    <a href="/audit-logs" class="hover:text-gray-300">Audit Logs</a>
                    <a href="/config" class="hover:text-gray-300">Remote Config</a>
                    <Button 
                        variant="danger"
                        onClick={() => logout()}
                    >
                        Logout
                    </Button>
                </nav>
            </header>
            <main class="flex-1 overflow-auto bg-gray-100 relative">
                {children}
            </main>
        </div>
    );
}
