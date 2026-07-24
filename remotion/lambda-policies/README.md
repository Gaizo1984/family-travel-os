# Remotion Lambda IAM-Policies (nur Referenz)

Diese beiden Dateien sind **wortwörtlich die Ausgabe** von `npx remotion lambda policies role` bzw.
`npx remotion lambda policies user`, erzeugt lokal (keine AWS-Zugangsdaten nötig), erzeugt mit
`@remotion/lambda@4.0.498`.

**Wichtig:** Vor dem tatsächlichen Einrichten in AWS die Befehle erneut lokal ausführen und mit diesen
Dateien vergleichen -- falls sich `@remotion/lambda` zwischenzeitlich aktualisiert hat, können sich die
benötigten Rechte geändert haben. Diese Dateien sind ein Stand vom Zeitpunkt der Vorbereitung
(Etappe 1), keine dauerhaft gültige Quelle der Wahrheit.

- `role-policy.json` → für die Lambda-Ausführungsrolle (`remotion-lambda-role`).
- `user-policy.json` → als Inline-Policy für den Deploy-/Trigger-IAM-Nutzer.

Beide sind bereits eng auf die Namenspräfixe `remotionlambda-*` (S3) und `remotion-render-*`
(Lambda/CloudWatch Logs) beschränkt -- `Resource: "*"` taucht nur bei Aktionen auf, die AWS
grundsätzlich nicht feiner scopen lässt (z. B. `s3:ListAllMyBuckets`, `servicequotas:*`,
`iam:SimulatePrincipalPolicy`, `lambda:ListFunctions`/`GetFunction`) -- das sind reine
Lese-/Auflistungs-Rechte, keine Schreibrechte auf fremde Ressourcen.
