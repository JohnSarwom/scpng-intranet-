
$file = Get-ChildItem -Path "C:\Users\IT_UNIT\Desktop\Coding\scpng-intranet\public\files" -Filter "*Coordination*" | Select-Object -ExpandProperty FullName
$tmpZip = "C:\Users\IT_UNIT\Desktop\Coding\scpng-intranet\tmp\doc_copy.zip"
$extractPath = "C:\Users\IT_UNIT\Desktop\Coding\scpng-intranet\tmp\extracted_docx"
$outFile = "C:\Users\IT_UNIT\Desktop\Coding\scpng-intranet\tmp\extracted_text.txt"

# Cleanup
if (Test-Path $tmpZip) { Remove-Item $tmpZip -Force }
if (Test-Path $extractPath) { Remove-Item $extractPath -Recurse -Force }
if (Test-Path $outFile) { Remove-Item $outFile -Force }

# Copy and Expand
Copy-Item "$file" "$tmpZip"
Expand-Archive -Path "$tmpZip" -DestinationPath "$extractPath" -Force

# Read document.xml
$xmlPath = Join-Path $extractPath "word/document.xml"
if (Test-Path $xmlPath) {
    [xml]$xml = Get-Content $xmlPath
    $ns = New-Object System.Xml.XmlNamespaceManager($xml.NameTable)
    $ns.AddNamespace("w", "http://schemas.openxmlformats.org/wordprocessingml/2006/main")

    $bodyNodes = $xml.SelectNodes("/w:document/w:body/*", $ns)
    $output = @()

    foreach ($node in $bodyNodes) {
        if ($node.LocalName -eq "p") {
            $pText = ($node.SelectNodes(".//w:t", $ns) | ForEach-Object { $_.InnerText }) -join ""
            if ($pText) { $output += $pText }
            else { $output += "" } # Empty paragraph for spacing
        }
        elseif ($node.LocalName -eq "tbl") {
            $output += "`n[TABLE START]"
            $rows = $node.SelectNodes("./w:tr", $ns)
            foreach ($row in $rows) {
                $cells = $row.SelectNodes("./w:tc", $ns)
                $cellTexts = @()
                foreach ($cell in $cells) {
                    $txt = ($cell.SelectNodes(".//w:t", $ns) | ForEach-Object { $_.InnerText }) -join ""
                    $cellTexts += $txt.Trim()
                }
                $output += "| " + ($cellTexts -join " | ") + " |"
            }
            $output += "[TABLE END]`n"
        }
    }

    $output | Out-File -FilePath "$outFile" -Encoding utf8
} else {
    Write-Error "Could not find word/document.xml at $xmlPath"
}
