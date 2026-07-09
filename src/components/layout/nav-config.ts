import {
  LayoutDashboard,
  Users,
  Truck,
  Package,
  Wallet,
  FileBarChart,
  Settings,
  UsersRound,
  Paperclip,
  Boxes,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  title: string;
  to: string;
  icon: LucideIcon;
  group: "operação" | "gestão" | "sistema";
}

export const NAV_ITEMS: NavItem[] = [
  { title: "Dashboard", to: "/dashboard", icon: LayoutDashboard, group: "operação" },
  { title: "Pedidos", to: "/pedidos", icon: Package, group: "operação" },
  { title: "Produtos", to: "/produtos", icon: Boxes, group: "operação" },
  { title: "Clientes", to: "/clientes", icon: Users, group: "gestão" },
  { title: "Fornecedores", to: "/fornecedores", icon: Truck, group: "gestão" },
  { title: "Funcionários", to: "/funcionarios", icon: UsersRound, group: "gestão" },
  { title: "Financeiro", to: "/financeiro", icon: Wallet, group: "gestão" },
  { title: "Anexos", to: "/anexos", icon: Paperclip, group: "gestão" },
  { title: "Relatórios", to: "/relatorios", icon: FileBarChart, group: "gestão" },
  { title: "Configurações", to: "/configuracoes", icon: Settings, group: "sistema" },
];
