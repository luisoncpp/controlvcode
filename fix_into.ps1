
$f = 'src-tauri\src\lib.rs'
$lines = Get-Content $f
for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match 'Hunk header malformado|No se encontraron hunks') {
        $lines[$i] = $lines[$i].Replace('.into()', '.to_string()')
    }
}
$lines | Set-Content $f
