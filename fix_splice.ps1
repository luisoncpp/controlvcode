
$f = 'src-tauri\src\lib.rs'
$lines = Get-Content $f
for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match 'Reemplazar old_side por new_side en la posicion encontrada') {
        # Insert new_count line before the splice
        $lines[$i] = "        let new_count = new_side.len();"
        # Next line stays
        $i++
        # Then replace the offset line
        $i++
        if ($i -lt $lines.Count) {
            $lines[$i] = "        offset += new_count as i32 - old_side.len() as i32;"
        }
    }
}
$lines | Set-Content $f
