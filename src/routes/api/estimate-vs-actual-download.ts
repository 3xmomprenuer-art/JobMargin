import { createFileRoute } from "@tanstack/react-router";

const CSV = `Job Name,Date,Estimated Quote,Estimated Materials,Estimated Labor Hours,Estimated Labor Rate,Actual Materials,Actual Labor Hours,Actual Labor Rate,Estimated Subs,Actual Subs,Estimated Disposal/Travel,Actual Disposal/Travel,Profit (Estimated),Profit (Actual),Variance,Notes
Kitchen faucet replacement,2026-08-05,850,180,5,75,195,6,75,0,0,40,55,255,150,-105,Extra supply-house trip
Fence repair,2026-08-06,2400,650,18,65,620,16,65,300,300,120,95,160,345,185,Finished under estimated hours
`;

export const Route = createFileRoute("/api/estimate-vs-actual-download")({
  server: {
    handlers: {
      GET: () =>
        new Response(CSV, {
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": 'attachment; filename="estimate-vs-actual-template.csv"',
          },
        }),
    },
  },
});
