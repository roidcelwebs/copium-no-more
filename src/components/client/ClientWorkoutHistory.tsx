import { useAccount } from "@/components/account/AccountProvider";
import { WorkoutHistoryList } from "@/components/workout-history/WorkoutHistoryList";

export function ClientWorkoutHistory() {
  const { account } = useAccount();
  if (!account || account.role !== "client") return null;

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Workout History</h1>
        <p className="mt-1.5 text-[1rem] leading-6 text-muted-foreground">
          Review your completed workouts, logged sets, and notes. Switch between list and calendar views.
        </p>
      </div>
      <WorkoutHistoryList clientId={account.id} />
    </section>
  );
}
