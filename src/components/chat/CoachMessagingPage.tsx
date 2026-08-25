import { MessagesSquare, Radio } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BroadcastComposer } from "./BroadcastComposer";
import { CoachChatInbox } from "./CoachChatInbox";

export function CoachMessagingPage() {
  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Messaging</h1>
        <p className="mt-1.5 text-[1rem] leading-6 text-muted-foreground">
          Client conversations, automated messages, and broadcasts.
        </p>
      </div>

      <Tabs defaultValue="conversations" className="w-full">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 rounded-xl p-1">
          <TabsTrigger value="conversations" className="min-h-11 gap-1.5 rounded-lg px-3 py-2.5 text-[1rem] font-medium">
            <MessagesSquare className="h-5 w-5" aria-hidden="true" />
            Conversations
          </TabsTrigger>
          <TabsTrigger value="broadcasts" className="min-h-11 gap-1.5 rounded-lg px-3 py-2.5 text-[1rem] font-medium">
            <Radio className="h-5 w-5" aria-hidden="true" />
            Broadcasts
          </TabsTrigger>
        </TabsList>

        <TabsContent value="conversations" className="mt-6">
          <CoachChatInbox showHeader={false} />
        </TabsContent>

        <TabsContent value="broadcasts" className="mt-6">
          <BroadcastComposer />
        </TabsContent>
      </Tabs>
    </section>
  );
}
