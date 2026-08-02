export const mergeDatasets = (
    data1: any[][],
    data2: any[][],
    keyCol1: number,
    keyCol2: number,
    mode: 'inner' | 'outer' | 'left'
): any[][] => {
    if (!data1.length || !data2.length) return data1.length ? data1 : data2;

    const headers1 = data1[0] || [];
    const headers2 = data2[0] || [];

    // Identify unique headers from data2 that are not in data1
    const extraHeaders2: string[] = [];
    const extraColIndices2: number[] = [];
    for (let c = 0; c < headers2.length; c++) {
        if (c !== keyCol2 && !headers1.includes(headers2[c])) {
            extraHeaders2.push(headers2[c]);
            extraColIndices2.push(c);
        }
    }

    const mergedHeaders = [...headers1, ...extraHeaders2];
    const map2 = new Map<string, any[]>();
    for (let i = 1; i < data2.length; i++) {
        const row = data2[i];
        if (row && row[keyCol2] !== undefined) {
             map2.set(String(row[keyCol2]).trim().toLowerCase(), row);
        }
    }

    const result: any[][] = [mergedHeaders];
    const seenMap2Keys = new Set<string>();

    for (let i = 1; i < data1.length; i++) {
        const row1 = data1[i];
        if(!row1) continue;
        const key = String(row1[keyCol1] ?? '').trim().toLowerCase();
        
        const mergedRow = [...row1];
        if (map2.has(key)) {
            seenMap2Keys.add(key);
            const row2 = map2.get(key)!;
            extraColIndices2.forEach(c2idx => {
                mergedRow.push(row2[c2idx]);
            });
            result.push(mergedRow);
        } else {
            if (mode === 'left' || mode === 'outer') {
                extraColIndices2.forEach(() => {
                    mergedRow.push('');
                });
                result.push(mergedRow);
            }
        }
    }

    if (mode === 'outer') {
        map2.forEach((row2, key) => {
            if (!seenMap2Keys.has(key)) {
                const mergedRow = new Array(headers1.length).fill('');
                // Attempt to put the key in keyCol1 position if possible, else just keep empty
                if (keyCol1 >= 0 && keyCol1 < mergedRow.length) {
                    mergedRow[keyCol1] = row2[keyCol2];
                }
                extraColIndices2.forEach(c2idx => {
                    mergedRow.push(row2[c2idx]);
                });
                result.push(mergedRow);
            }
        });
    }

    return result;
}
