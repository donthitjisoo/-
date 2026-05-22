import { InvestmentDashboard } from "@/components/investment-dashboard";
import { getDashboard } from "@/lib/investmentService";

export const dynamic = "force-dynamic";

export default async function Home() {
  const dashboard = await getDashboard();
  return <InvestmentDashboard initialData={dashboard} />;
}
