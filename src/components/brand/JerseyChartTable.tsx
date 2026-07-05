import type { JerseyChartRow } from '@/lib/types'

export function JerseyChartTable({ chart }: { chart: JerseyChartRow[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[320px] text-sm">
        <thead>
          <tr className="bg-muted text-muted-foreground">
            <th className="px-3 py-2 text-left font-medium">Size</th>
            <th className="px-3 py-2 text-left font-medium">Chest (in)</th>
            <th className="px-3 py-2 text-left font-medium">Length (in)</th>
          </tr>
        </thead>
        <tbody>
          {chart.map((row) => (
            <tr key={row.size} className="border-t border-border">
              <td className="px-3 py-2 font-medium text-foreground">{row.size}</td>
              <td className="px-3 py-2">{row.chest}</td>
              <td className="px-3 py-2">{row.length}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
