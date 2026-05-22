# Google Sheets Template

Create a Google Spreadsheet with exactly these three tabs.

## recommendations

```csv
id,date,symbol,target_price,recommended_price,recommender,note
rec_001,2026-05-22,2330,1180,950,Tom,AI server supply chain
rec_002,2026-05-22,3661,520,410,Alice,TPEX semiconductor
```

## holdings

```csv
id,symbol,shares,avg_cost,broker,account,note
holding_001,2330,1000,850,富邦,主帳戶,核心持倉
holding_002,3661,200,390,永豐,短線帳戶,波段
```

## price_history

```csv
date,symbol,open,high,low,close,volume
2026-05-22,2330,950,990,945,980,45000000
2026-05-22,3661,410,450,405,440,3500000
```

`price_history` is optional but recommended. If it has no matching records, the backend tries Yahoo Finance daily history for target achievement calculations.
