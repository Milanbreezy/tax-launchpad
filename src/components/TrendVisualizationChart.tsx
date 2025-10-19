"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"
import { TrendingUp, BarChart3, Download, Info } from "lucide-react"
import type { CleanedDataRecord } from "@/lib/types"

interface TrendVisualizationChartProps {
  data: CleanedDataRecord[]
}

export function TrendVisualizationChart({ data }: TrendVisualizationChartProps) {
  const [chartType, setChartType] = useState<"line" | "bar">("line")
  const [selectedTaxType, setSelectedTaxType] = useState<string>("all")
  const [selectedYear, setSelectedYear] = useState<string>("all")

  // Extract unique tax types and years from data
  const { taxTypes, years } = useMemo(() => {
    const taxTypesSet = new Set<string>()
    const yearsSet = new Set<string>()

    data.forEach((record) => {
      if (record.taxType && !record.isEmptyRow && !record.hasTotals) {
        taxTypesSet.add(record.taxType)
      }
      if (record.payrollYear && !record.isEmptyRow && !record.hasTotals) {
        yearsSet.add(record.payrollYear)
      }
    })

    return {
      taxTypes: Array.from(taxTypesSet).sort(),
      years: Array.from(yearsSet).sort(),
    }
  }, [data])

  // Process data for chart
  const chartData = useMemo(() => {
    // Filter data based on selections
    let filteredData = data.filter((record) => !record.isEmptyRow && !record.hasTotals)

    if (selectedTaxType !== "all") {
      filteredData = filteredData.filter((record) => record.taxType === selectedTaxType)
    }

    if (selectedYear !== "all") {
      filteredData = filteredData.filter((record) => record.payrollYear === selectedYear)
    }

    // Group by period and year
    const groupedData = new Map<string, { debit: number; credit: number; arrears: number; count: number }>()

    filteredData.forEach((record) => {
      const key = `${record.payrollYear}-${record.period}`
      const existing = groupedData.get(key) || { debit: 0, credit: 0, arrears: 0, count: 0 }

      groupedData.set(key, {
        debit: existing.debit + (record.debitAmount || 0),
        credit: existing.credit + (record.creditAmount || 0),
        arrears: existing.arrears + (record.arrears || 0),
        count: existing.count + 1,
      })
    })

    // Convert to array and sort by period
    return Array.from(groupedData.entries())
      .map(([key, values]) => ({
        period: key,
        debit: Math.round(values.debit),
        credit: Math.round(values.credit),
        arrears: Math.round(values.arrears),
        count: values.count,
      }))
      .sort((a, b) => a.period.localeCompare(b.period))
  }, [data, selectedTaxType, selectedYear])

  // Calculate summary statistics
  const summary = useMemo(() => {
    const totalArrears = chartData.reduce((sum, item) => sum + item.arrears, 0)
    const avgPayment =
      chartData.length > 0 ? chartData.reduce((sum, item) => sum + item.credit, 0) / chartData.length : 0

    // Find most active tax type
    const taxTypeCounts = new Map<string, number>()
    data.forEach((record) => {
      if (!record.isEmptyRow && !record.hasTotals && record.taxType) {
        taxTypeCounts.set(record.taxType, (taxTypeCounts.get(record.taxType) || 0) + 1)
      }
    })

    let mostActiveTaxType = "N/A"
    let maxCount = 0
    taxTypeCounts.forEach((count, taxType) => {
      if (count > maxCount) {
        maxCount = count
        mostActiveTaxType = taxType
      }
    })

    return {
      totalArrears,
      avgPayment,
      mostActiveTaxType,
    }
  }, [chartData, data])

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "decimal",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  const handleExportChart = () => {
    // Create CSV data
    const csvData = [
      ["Period", "Debit (TZS)", "Credit (TZS)", "Arrears (TZS)", "Record Count"],
      ...chartData.map((item) => [
        item.period,
        item.debit.toString(),
        item.credit.toString(),
        item.arrears.toString(),
        item.count.toString(),
      ]),
    ]

    const csvContent = csvData.map((row) => row.join(",")).join("\n")
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)

    link.setAttribute("href", url)
    link.setAttribute("download", `tax-position-trend-${new Date().toISOString().split("T")[0]}.csv`)
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  if (data.length === 0) {
    return (
      <Card className="border-muted">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-muted-foreground" />
            </div>
            <div>
              <CardTitle>Tax Position Trend Visualization</CardTitle>
              <CardDescription>Visual insights into tax position patterns over time</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Info className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No data available. Upload tax position data to view trends.</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-primary/30">
      <CardHeader>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
            <TrendingUp className="w-6 h-6 text-primary" />
          </div>
          <div className="flex-1">
            <CardTitle>Tax Position Trend Visualization</CardTitle>
            <CardDescription>Visual insights into tax position patterns over time</CardDescription>
          </div>
        </div>

        {/* Summary Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Total Arrears</p>
            <p className="text-lg font-bold font-mono">{formatCurrency(summary.totalArrears)} TZS</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Average Payment per Period</p>
            <p className="text-lg font-bold font-mono">{formatCurrency(summary.avgPayment)} TZS</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Most Active Tax Type</p>
            <p className="text-lg font-bold">{summary.mostActiveTaxType}</p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Button
              variant={chartType === "line" ? "default" : "outline"}
              size="sm"
              onClick={() => setChartType("line")}
              className="gap-2"
            >
              <TrendingUp className="w-4 h-4" />
              Line Chart
            </Button>
            <Button
              variant={chartType === "bar" ? "default" : "outline"}
              size="sm"
              onClick={() => setChartType("bar")}
              className="gap-2"
            >
              <BarChart3 className="w-4 h-4" />
              Bar Chart
            </Button>
          </div>

          <div className="flex items-center gap-2 flex-1">
            <Select value={selectedTaxType} onValueChange={setSelectedTaxType}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by Tax Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tax Types</SelectItem>
                {taxTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Filter by Year" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Years</SelectItem>
                {years.map((year) => (
                  <SelectItem key={year} value={year}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button variant="outline" size="sm" onClick={handleExportChart} className="gap-2 bg-transparent">
            <Download className="w-4 h-4" />
            Export Chart Data
          </Button>
        </div>

        {/* Chart */}
        <div className="w-full h-[400px] mt-4">
          <ResponsiveContainer width="100%" height="100%">
            {chartType === "line" ? (
              <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="period"
                  className="text-xs"
                  tick={{ fill: "hsl(var(--muted-foreground))" }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis
                  className="text-xs"
                  tick={{ fill: "hsl(var(--muted-foreground))" }}
                  tickFormatter={formatCurrency}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                  formatter={(value: number) => formatCurrency(value) + " TZS"}
                />
                <Legend wrapperStyle={{ paddingTop: "20px" }} />
                <Line
                  type="monotone"
                  dataKey="debit"
                  stroke="hsl(217, 91%, 60%)"
                  strokeWidth={2}
                  name="Debit"
                  dot={{ fill: "hsl(217, 91%, 60%)" }}
                />
                <Line
                  type="monotone"
                  dataKey="credit"
                  stroke="hsl(142, 76%, 36%)"
                  strokeWidth={2}
                  name="Credit"
                  dot={{ fill: "hsl(142, 76%, 36%)" }}
                />
                <Line
                  type="monotone"
                  dataKey="arrears"
                  stroke="hsl(0, 84%, 60%)"
                  strokeWidth={2}
                  name="Arrears"
                  dot={{ fill: "hsl(0, 84%, 60%)" }}
                />
              </LineChart>
            ) : (
              <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="period"
                  className="text-xs"
                  tick={{ fill: "hsl(var(--muted-foreground))" }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis
                  className="text-xs"
                  tick={{ fill: "hsl(var(--muted-foreground))" }}
                  tickFormatter={formatCurrency}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                  formatter={(value: number) => formatCurrency(value) + " TZS"}
                />
                <Legend wrapperStyle={{ paddingTop: "20px" }} />
                <Bar dataKey="debit" fill="hsl(217, 91%, 60%)" name="Debit" />
                <Bar dataKey="credit" fill="hsl(142, 76%, 36%)" name="Credit" />
                <Bar dataKey="arrears" fill="hsl(0, 84%, 60%)" name="Arrears" />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>

        {/* Legend Info */}
        <div className="flex flex-wrap gap-4 pt-4 border-t text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: "hsl(217, 91%, 60%)" }}></div>
            <span className="text-muted-foreground">Debit = Total tax assessed</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: "hsl(142, 76%, 36%)" }}></div>
            <span className="text-muted-foreground">Credit = Payments made</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: "hsl(0, 84%, 60%)" }}></div>
            <span className="text-muted-foreground">Arrears = Outstanding balance</span>
          </div>
        </div>

        {chartData.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Info className="w-8 h-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              No data matches the selected filters. Try adjusting your filter criteria.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
