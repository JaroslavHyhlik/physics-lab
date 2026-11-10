# PLAN – Physics Lab (pracovní název)

Interaktivní fyzikální laboratoř pro **IB Physics HL** (osnova s prvními zkouškami 2025, témata A–E)
a k tomu **mobilní měřicí laboratoř** se senzory telefonu ve stylu phyphox.
Inspirace PhET, ale vlastní kód a vlastní, modernější design.

> **Stav: schváleno 2026-11-09.** Probíhá fáze 1.
>
> Značky: **HL** = látka jen pro Higher Level · ➕ = navíc nad tvůj seznam (z osnovy) ·
> *Test:* = s čím automatický test porovnává výsledek simulace.
> Označení HL a značení veličin podle **Physics data booklet, first assessment 2025, verze 1.2**
> (sekce „Additional higher level“). Shrnutí je v [docs/ib-reference.md](docs/ib-reference.md).

## ▶ Kde pokračovat (aktualizuje se po každé hotové simulaci)

| | |
|---|---|
| **Aktuální fáze** | 2 – Téma A: A.1–A.3 (fáze 1 hotová kromě kontroly na iPhonu) |
| **Naposledy hotovo** | (9.–10. 11.) Projectile motion, Inclined plane, Collisions 1D, Collisions 2D, Banked curve, Drag & buoyancy, Newton's laws (lift), Rocket (1 stupeň; vícestupňová raketa zatím ne); sdílené pomocníky `src/sim/setup.svelte.ts`. Dříve: základ (jádro, design, grafy, nástroje, CSV, PWA, Web Worker, testy fyziky + testy webu, GitHub Actions) a 3 ukázkové simulace: kyvadlo, auto, náboje a pole |
| **Další krok** | Fáze 2: **Spring launcher & elastic energy** (pak Work power, Roller coaster, Motion graphs lab, Car drift, A.3; svislá smyčka přesunuta do Roller coaster) |
| **Rozpracováno / poznámky** | Web je zveřejněný. Čeká na uživatele: kontrola na iPhonu, zpětná vazba k designu (viz OTAZKY.md). Noční/automatické běhy pracují ve větvi `night`, do `main` až po schválení. Nová simulace = složka `src/sims/<id>/` (meta.ts, render.ts, Sim.svelte) podle vzoru `c1-pendulum`, model v `src/physics/`, testy v `tests/physics/`, v `src/app/registry.ts` přidat `load`, v `tests/e2e/smoke.spec.ts` přidat id do `READY`. |

**Jak navázat v nové session:** otevři v Claude novou session ve složce `~/Projects/physics-lab`
a napiš: *„Pokračuj podle PLAN.md.“* Pravidla v CLAUDE.md se načtou automaticky.

---

## Přehled fází

| Fáze | Obsah | Simulací |
|---|---|---|
| 1 | Základ (design, jádro simulací, grafy, nástroje, testy) + 3 ukázkové simulace + zveřejnění na GitHub Pages | 3 |
| 2 | Téma A: kinematika, síly a hybnost, energie (A.1–A.3) | 13 |
| 3 | Téma A, HL: tuhé těleso a relativita (A.4–A.5) | 9 |
| 4 | Mobilní laboratoř (senzory iPhonu, nástroje, porovnání se simulací) | – |
| 5 | Téma B: teplo, skleníkový efekt, plyny, termodynamika, obvody | 17 |
| 6 | Téma C: kmity a vlny | 14 |
| 7 | Téma D: gravitační, elektrické a magnetické pole, indukce | 11 |
| 8 | Téma E: atom, kvantová fyzika, radioaktivita, štěpení, hvězdy | 17 |
| 9 | Závěrečná kontrola přesnosti, výkonu a přístupnosti, finální zveřejnění | – |

Celkem **84 simulací** + mobilní laboratoř. Pořadí fází 2–8 můžeme kdykoli přehodit.

Na konci **každé** fáze: spustím všechny testy, sestavím web, projdu každou novou simulaci
v prohlížeči (počítač i mobilní šířka), uložím změny do gitu, odškrtnu body tady
a nahraju novou verzi na web.

---

## Technické řešení

| Část | Volba | Proč |
|---|---|---|
| Sestavení | **Vite** | rychlý vývojový server, malé výsledné soubory |
| Jazyk | **TypeScript** | typy hlídají jednotky a chyby už při psaní |
| Ovládací panely | **Svelte 5** | lehká a rychlá knihovna pro UI; simulace samotné na ní nezávisí |
| Vykreslování | **Canvas 2D**, u náročných věcí **WebGL2** | vlnová vana, mapy potenciálu a tisíce částic potřebují GPU |
| Náročné výpočty | **Web Workery** | plyn, molekulová dynamika, vlnová vana, N těles poběží mimo hlavní vlákno, UI se nezasekne |
| Grafy | **uPlot** | nejrychlejší knihovna pro živé grafy (tisíce bodů při 60 fps) |
| Vzorce | **KaTeX** | sazba vzorců jako v data bookletu |
| Testy fyziky | **Vitest** | porovnání s analytickým řešením, zákony zachování |
| Testy webu | **Playwright** | každá simulace se načte, kreslí a nehází chyby (desktop i mobil); poběží na GitHubu |
| Offline | **PWA** | web jde přidat na plochu iPhonu a funguje bez internetu (laboratoř ve škole) |
| Hosting | **GitHub Pages + GitHub Actions** | zdarma, HTTPS; po každém nahrání se automaticky spustí testy a web se aktualizuje |

Další rozhodnutí:
- Adresy simulací typu `#/sim/c1-pendulum?L=1.2&theta0=30` → dá se sdílet odkaz na konkrétní nastavení.
- Každá simulace se načítá zvlášť (code splitting), úvodní stránka zůstane rychlá i s 84 simulacemi.
- Konstanty podle **IB data booklet** (g = 9.8 m s⁻², c = 3.00 × 10⁸ m s⁻¹, …), aby výsledky
  seděly s výpočty na papíře. Přesnější hodnoty CODATA jen tam, kde na tom záleží (uvedu to).
  Značení veličin podle bookletu (např. μ_s/μ_d, E_H, F_b, ε pro emn, Φ pro tok i výstupní práci).
- Náhodné simulace (rozpad, plyn) používají generátor se semínkem → testy jsou opakovatelné.

### Architektura: fyzika oddělená od vykreslování

```
src/core/      čistý TypeScript bez prohlížeče: integrátory, pevný časový krok,
               vektory, konstanty, jednotky, náhodná čísla, CSV
src/physics/   model každé simulace (stav + step(dt)) – testuje se samostatně
src/sims/<id>/ obrazovka simulace: vykreslení, ovládání, grafy, popis, vzorce
src/ui/        design systém: posuvník s jednotkou, tlačítka, panely, graf, vzorec, HL štítek
src/tools/     pravítko, stopky, sonda, úhloměr
src/lab/       mobilní laboratoř (senzory)
src/workers/   výpočty pro Web Workery
tests/         testy fyziky (Vitest) a testy webu (Playwright)
```

Smyčka simulace: fyzika běží s **pevným krokem dt** (např. 1 ms) přes „akumulátor času“,
nezávisle na snímkové frekvenci. Zpomalení (0.1×–2×), pauza a krok po kroku mění jen to,
kolik kroků proběhne; výsledky jsou tedy stejné při 30 i 120 fps.

### Numerické metody

| Problém | Metoda | Proč |
|---|---|---|
| Oběžné dráhy, N těles, molekulová dynamika | rychlostní Verlet / Yoshida 4. řádu (symplektické) | energie se dlouhodobě neztrácí |
| Odpor vzduchu, auto, raketa, tlumené kmity | RK4 | vysoká přesnost u hladkých nekonzervativních sil |
| Kyvadlo bez tlumení | symplektická metoda + kontrola RK4 | perioda i energie i po tisících kmitů |
| Nabitá částice v B poli | Borisova metoda | magnetické pole nekoná práci ani numericky |
| Vlnová vana, struna | konečné diference s podmínkou CFL, pohlcující okraje | stabilita, žádné falešné odrazy od okraje |
| Siločáry | adaptivní RK45 | hladké čáry i blízko nábojů |
| Ekvipotenciály | marching squares na mřížce potenciálu | přesné vrstevnice |
| Plyn | srážky tuhých koulí ve 3D (vykreslené jako 2D průmět) s mřížkou buněk | vzorce pV = NkT a ⟨E_k⟩ = 3/2 kT platí přesně jako v IB (3D) |
| Obvody | modifikovaná uzlová analýza + Newtonova metoda | Kirchhoffovy zákony přesně, i pro žárovku a diodu |
| Vedení tepla | Crankova–Nicolsonova metoda | stabilní pro libovolný krok |
| Reaktor | bodová kinetika se zpožděnými neutrony | realistická odezva na regulační tyče |

### Jak ověřujeme přesnost

1. **Jádro:** integrátory mají test řádu přesnosti (RK4 při polovičním kroku → chyba ~16× menší).
2. **Analytická řešení:** každá simulace má test proti známému vzorci (viz *Test:* u každého bodu).
3. **Zákony zachování:** energie, hybnost, moment hybnosti, náboj – s jasně danou tolerancí.
4. **Statistika:** náhodné simulace se pevným semínkem, porovnání v rozmezí statistické chyby.
5. **Web:** Playwright otevře každou simulaci, ověří, že kreslí, reaguje na ovládání a nehází chyby.
6. **Výkon:** vestavěný měřič (fps, čas fyziky na snímek) + ruční kontrola na iPhonu.

Když je model zjednodušený, simulace to **přímo ukazuje** v rámečku *Model assumptions*
(např. „tyres: simplified Pacejka model“, „2D slice of a 3D field“).

### Co musíš mít nainstalované

- **Node.js 24 LTS** – hotovo (nainstalováno do `~/.local/node`, přidáno do PATH v `~/.zshrc`).
- **git** – máš.
- **GitHub CLI (`gh`)** – nainstaluji na konci fáze 1 (zeptám se); jednou se přihlásíš
  v Terminálu příkazem `gh auth login` (přihlášení děláš ty, já hesla nezadávám).

Spuštění na Macu (vysvětlím i v README):

```bash
cd ~/Projects/physics-lab
npm install        # jen poprvé – stáhne knihovny
npm run dev        # spustí web na http://localhost:5173
npm test           # spustí testy fyziky
```

---

## Definice hotové simulace (platí pro každou)

- [ ] fyzikální model v `src/physics/` je oddělený od kreslení, běží s pevným krokem
- [ ] posuvníky pro všechny důležité veličiny, jednotky SI, rozumné rozsahy
- [ ] start, pauza, krok po kroku, zpomalení, reset, přednastavené situace (presets)
- [ ] živé grafy podle tématu (poloha, rychlost, zrychlení, energie, …)
- [ ] měřicí nástroje (pravítko, stopky, sonda), kde to dává smysl
- [ ] krátké vysvětlení, vzorce v notaci IB data bookletu, štítek **HL** u HL látky
- [ ] rámeček *Model assumptions* se všemi zjednodušeními
- [ ] export dat do CSV (volitelně formát pro český Excel: středník + desetinná čárka)
- [ ] automatický test proti analytickému řešení / známému výsledku
- [ ] funguje myší i dotykem, na mobilu i počítači, ve světlém i tmavém režimu, plynulých 60 fps

## Design

- Čistý moderní vzhled: tmavý a světlý režim (+ automaticky podle systému), jemné „skleněné“ panely,
  písmo Inter, čísla s pevnou šířkou (nehýbou se při změně), barvy grafů čitelné i pro barvoslepé.
- Počítač: plátno simulace uprostřed, ovládání vpravo, grafy dole (lze zvětšit/skrýt).
- Mobil: plátno nahoře, dole vysouvací panel se záložkami *Controls / Graphs / Tools / Info*.
- Plynulé animace (150–250 ms), respektuje „omezit pohyb“ v systému; dotykové prvky ≥ 44 px.
- Úvodní stránka: témata A–E s podtématy, karty s náhledem, štítky SL/HL, vyhledávání
  (podle názvu, pojmu nebo kódu, např. „Snell“, „C.3“), filtr jen HL, vstup do mobilní laboratoře.
- V patičce: „Not affiliated with or endorsed by the International Baccalaureate Organization.“

---

## Fáze 1 – Základ + 3 ukázkové simulace

Základ:
- [x] Projekt: Vite + TypeScript + Svelte, formátování kódu, Vitest, Playwright
- [x] Design systém: barvy a rozměry (tokeny), světlý/tmavý režim, komponenty (posuvník s jednotkou, tlačítka, přepínače, panely, záložky)
- [x] Rozvržení stránky simulace (počítač + mobilní vysouvací panel)
- [x] Úvodní stránka: témata A–E, karty, vyhledávání, filtr HL
- [x] Jádro simulací: pevný časový krok, pauza/krok/zpomalení/reset, presets, parametry v URL
- [x] Numerika: semi-implicitní Euler, RK4, RK45, rychlostní Verlet, Yoshida 4, Boris; vektory; konstanty z data bookletu; generátor náhodných čísel se semínkem
- [x] Živé grafy (uPlot): více veličin, odečítání hodnot kurzorem, pauza, přiblížení
- [x] Měřicí nástroje: pravítko, stopky, sonda (napojitelné na každou simulaci)
- [x] Panel Info: vysvětlení, vzorce (KaTeX), štítek HL, *Model assumptions*
- [x] Export CSV (+ formát pro český Excel)
- [x] Infrastruktura pro Web Workery
- [x] Měřič výkonu (fps, čas fyziky na snímek)
- [x] PWA: offline, ikona na ploše iPhonu
- [x] Testy jádra (řád přesnosti integrátorů, zachování energie) + smoke test každé simulace

Ukázkové simulace:
- [x] **A.1 Car acceleration** – výkonová/momentová křivka motoru, hmotnost, převodové stupně a řazení, valivý odpor, mez přilnavosti pneumatik (μ), odpor vzduchu ½ρC_dAv²; grafy x–t, v–t, a–t, síly a výkon; měření 0–100 km/h; presets (malé auto, sporťák, elektromobil, kamion). *Test:* maximální rychlost tam, kde výkon na kolech = (odpor vzduchu + valivý odpor)·v; bez odporů a při stálém výkonu v = √(2Pt/m); energetická bilance ∫P dt = E_k + ztráty.
- [x] **D.2 Charges and fields** – přetahování nábojů (±, velikost), vektory pole, siločáry, ekvipotenciály (HL), mapa potenciálu (HL), sonda E a V (HL), pravítko; presets: bodový náboj, dipól, dva stejné náboje, kvadrupól, deskový kondenzátor. *Test:* E = kq/r² a V = kq/r v sondě, princip superpozice, siločáry kolmé na ekvipotenciály, pole mezi deskami ≈ V/d uprostřed (do 1 %).
- [x] **C.1 Pendulum** – přesný nelineární model i pro velké výchylky, „duch“ s přiblížením malých úhlů pro srovnání, tlumení, graf úhlu/rychlosti/energie, fázový portrét, měření periody. *Test:* T = 2π√(l/g) pro malé výchylky; pro velké výchylky přesná perioda T = 4√(l/g)·K(sin(θ₀/2)) (eliptický integrál); zachování energie bez tlumení (< 10⁻⁶ za 1000 kmitů); útlum amplitudy podle analytického řešení.

Záloha a zveřejnění:
- [x] Hned na začátku: instalace GitHub CLI, tvoje přihlášení, **soukromý** repozitář → od té chvíle se každá hotová část nahrává na GitHub (záloha pro další session)
- [x] Na konci fáze: repozitář přepnut na veřejný, GitHub Actions: testy → sestavení → nasazení na GitHub Pages — **web běží na https://jaroslavhyhlik.github.io/physics-lab/**
- [ ] Kontrola webu na iPhonu (ty) + úprava designu podle tvé zpětné vazby

**Hotovo, když:** 3 simulace splňují definici hotové simulace, testy procházejí, web běží na
`https://<tvoje-jmeno>.github.io/physics-lab/` a designem jsi spokojený/á.

---

## Fáze 2 – Téma A: A.1–A.3

**A.1 Kinematics**
- [x] **Projectile motion** – vrh ve vakuu vs. s odporem vzduchu vedle sebe; rychlost, úhel, výška, hmotnost, průměr, C_d, hustota vzduchu; dosah, max. výška, doba letu; hledání optimálního úhlu; grafy x–t, y–t, v–t, a–t. *Test:* ve vakuu R = u²sin2θ/g a doba letu; s odporem svislá mezní rychlost v_t = √(2mg/ρC_dA) a přesné v(t) = v_t·tanh(gt/v_t).
- [ ] ➕ **Motion graphs lab** – ovládání pohybu (posuvník/tažení), živé x–t, v–t, a–t; nástroje směrnice a plochy pod grafem; výzvy „napodob graf“. *Test:* směrnice a plochy proti rovnicím rovnoměrně zrychleného pohybu (suvat).

**A.2 Forces and momentum**
- [x] **Inclined plane with friction** – silový diagram s rozkladem sil, statické vs. dynamické tření, tahová síla, rozpoznání prokluzu. *Test:* a = g(sinθ − μ_d cosθ); těleso stojí právě když tanθ ≤ μ_s (F_f ≤ μ_s F_N).
- [x] ➕ **Newton's laws: lift & connected bodies** – zdánlivá tíha ve výtahu, Atwoodův stroj, tělesa spojená lanem. *Test:* a = (m₁ − m₂)g/(m₁ + m₂), N = m(g + a).
- [x] ➕ **Drag, buoyancy & terminal velocity** – kulička v oleji, vodě, medu, vzduchu; Stokesův zákon F_d = 6πηrv, vztlak F_b = ρVg. *Test:* v_t = 2r²g(ρ_s − ρ_f)/(9η) a exponenciální náběh.
- [x] **Collisions 1D** – pružné i nepružné (koeficient restituce), hybnost a E_k ve sloupcích, graf F–t (impulz = plocha), „exploze“. *Test:* hybnost zachována na 10⁻¹², E_k zachována při pružné srážce, výsledné rychlosti podle vzorce.
- [x] **Collisions 2D** – vzduchový stůl, puky s poloměrem, parametr srážky, vektory hybnosti, soustava těžiště. *Test:* vektor hybnosti zachován; pružná srážka stejných hmotností → úhel 90°.
- [x] **Rocket with variable mass** – hmotnostní tok, výtoková rychlost, tah, odpor vzduchu s hustotou klesající s výškou, g(h) = GM/(R + h)², stupně rakety. *Test:* bez gravitace a odporu Ciolkovského Δv = v_e ln(m₀/m_f); tah F = v_e·Δm/Δt.
- [x] **Circular motion & banked curve** – auto v klopené zatáčce (poloměr, sklon, μ, rychlost), silový diagram, ideální rychlost, meze smyku; svislá kružnice (smyčka). *Test:* v_ideal = √(rg tanθ), max. a min. rychlost s třením; minimální rychlost ve smyčce √(gr).
- [ ] **Car drift** – auto shora (jednostopý model), model pneumatik (zjednodušený Pacejka + kruh tření, statické vs. dynamické tření), plyn/brzda/volant (klávesnice i dotyk), stopy smyku, úhly skluzu, síly na kolech. *Test:* boční zrychlení v ustálené zatáčce ≤ μ_s g; síla pneumatiky nikdy nepřekročí μF_N; brzdná dráha se zablokovanými koly v²/(2μ_d g).

**A.3 Work, energy and power**
- [ ] **Roller coaster with energy bars** – editovatelná dráha (spline), smyčky, tření, sloupce/koláč E_k, E_p, teplo; normálová síla (přetížení „g“), odlepení od dráhy. *Test:* bez tření energie zachována (< 10⁻⁶), v = √(2gΔh); s třením teplo = μ∫N ds.
- [ ] **Work, power & efficiency** – motor zvedá náklad / táhne bednu: W = Fs cosθ, P = Fv, účinnost, živý Sankeyův diagram. *Test:* W = mgh + ztráty, P = Fv, η = užitečný výkon / příkon.
- [ ] ➕ **Spring launcher & elastic energy** – pružina, Hookeův zákon, elastická potenciální energie, výška výstřelu. *Test:* ½kΔx² = mgh (bez ztrát), F = −kx.

**Hotovo, když:** všech 13 simulací splňuje definici hotové simulace a testy procházejí.

---

## Fáze 3 – Téma A, HL: A.4–A.5

**A.4 Rigid body mechanics (HL)**
- [ ] **Torque & equilibrium** – nosník/houpačka s posuvnými závažími, poloha podpěry, šikmé síly, podmínky ΣF = 0 a Στ = 0, žebřík u zdi. *Test:* m₁d₁ = m₂d₂, reakční síly z rovnováhy.
- [ ] **Rolling race** – koule, válec, obruč, dutá koule (a klouzající kvádr) na nakloněné rovině; moment setrvačnosti, podíl translační a rotační E_k, valení s prokluzem při malém μ. *Test:* a = g sinθ/(1 + I/mr²); zachování energie při valení bez prokluzu.
- [ ] **Conservation of angular momentum** – krasobruslařka/otočná židle s rukama, člověk chodící po kolotoči, disk spadlý na rotující disk. *Test:* Iω = konst., změna E_k podle vzorce.
- [ ] ➕ **Rotational dynamics (τ = Iα)** – setrvačník s padajícím závažím. *Test:* a = mg/(m + I/r²).

**A.5 Galilean and special relativity (HL)**
- [ ] **Galilean transformation** – dvě vztažné soustavy (vlak a nástupiště), události a rychlosti. *Test:* x′ = x − vt, u′ = u − v, zrychlení je stejné.
- [ ] **Spacetime (Minkowski) diagram** – přetahování událostí, světočáry, světelné kužely, osy ct′ a x′ pro rychlost v, čáry současnosti, invariantní hyperboly; presets: paradox dvojčat, tyč a stodola, relativita současnosti. *Test:* invariance intervalu, sklon os tanθ = v/c.
- [ ] **Time dilation** – světelné hodiny, mion letící atmosférou. *Test:* Δt = γΔt₀, podíl mionů, které doletí.
- [ ] **Length contraction** – vlak v tunelu, pohybující se tyč. *Test:* L = L₀/γ.
- [ ] **Lorentz transformation & velocity addition** – kalkulačka událostí s vizualizací. *Test:* transformace tam a zpět = identita; skládání rychlostí nikdy nepřekročí c.

**Hotovo, když:** všech 9 simulací splňuje definici hotové simulace a testy procházejí.

---

## Fáze 4 – Mobilní laboratoř (ve stylu phyphox)

### Co v prohlížeči na iPhonu jde a co ne (ověřeno v datech kompatibility MDN, listopad 2026)

| Senzor / funkce | iPhone (Safari) | Android (Chrome) | Poznámka |
|---|---|---|---|
| Akcelerometr (s g i bez g) | ✅ `DeviceMotionEvent` | ✅ | iPhone vyžaduje kliknutí na „Povolit“ a HTTPS |
| Gyroskop (úhlová rychlost) | ✅ `rotationRate` | ✅ | |
| Orientace, sklon, kompas | ✅ (kompasový kurz) | ✅ | iPhone dává jen kurz, ne hodnoty pole |
| Magnetometr (pole v µT) | ❌ | ⚠️ jen se zapnutým flagem | Safari nemá Generic Sensor API |
| Mikrofon | ✅ | ✅ | vypnu automatické úpravy zvuku (AGC, potlačení šumu) |
| GPS (poloha, rychlost, výška) | ✅ | ✅ | cca 1× za sekundu |
| Reproduktor (generátor tónu) | ✅ | ✅ | Audio Session API → hraje i při ztlumeném zvonění |
| Displej nezhasne při měření | ✅ Wake Lock | ✅ | |
| Barometr (tlak) | ❌ | ❌ | v prohlížečích neexistuje → nelze měřit výšku tlakem |
| Senzor světla | ❌ | ⚠️ jen s flagem | |
| Senzor přiblížení | ❌ | ❌ | z prohlížečů odstraněn |
| Bluetooth senzory | ❌ | ✅ | Safari nemá Web Bluetooth |
| Měření se zamčeným displejem / na pozadí | ❌ | ❌ | prohlížeč senzory na pozadí vypíná |

Vzorkovací frekvence pohybových senzorů není v prohlížeči zaručená (typicky ~60 Hz);
aplikace ji bude **měřit a zobrazovat**, aby bylo jasné, jak přesná data jsou.

Senzory:
- [ ] Kontrola senzorů: co tohle zařízení umí, žádost o povolení (iPhone), kontrola HTTPS, naměřená frekvence
- [ ] Akcelerometr: x, y, z, |a|, s g i bez g
- [ ] Gyroskop: úhlová rychlost x, y, z (rad s⁻¹), integrovaný úhel
- [ ] Orientace a kompas: sklon (sklonoměr), kurz; magnetometr jen tam, kde jde (Android s flagem)
- [ ] Mikrofon: průběh signálu (osciloskop), relativní hladina zvuku
- [ ] GPS: poloha, rychlost, výška, přesnost, trasa (bez mapového podkladu)

Nástroje:
- [ ] Akustické stopky (start a stop zvukem nad prahem; např. rychlost zvuku)
- [ ] Zvukové spektrum (FFT) s přesnou špičkovou frekvencí a spektrogramem
- [ ] Generátor tónu (sinus, obdélník, trojúhelník, pila; přeladění; dva tóny → rázy)
- [ ] Měření g (telefon v klidu, průměr a nejistota)
- [ ] Perioda kyvadla (telefon jako závaží; perioda → g)
- [ ] Dostředivé zrychlení (odstředivka na salát: a vs. ω², proložení → poloměr)
- [ ] Rychlost z GPS (rychlost, ujetá vzdálenost)
- [ ] ➕ Pružina (telefon na pružině → perioda → tuhost k) a výtah (zdánlivá tíha)

Společné:
- [ ] Start/stop, časové značky, živé grafy, export CSV, sdílení souboru (AirDrop) přes nabídku Sdílet
- [ ] **Porovnání se simulací:** otevření naměřených dat v odpovídající simulaci (kyvadlo, pružina, kruhový pohyb, volný pád) jako překryv v grafu + proložení parametrů
- [ ] QR kód „otevřít na telefonu“ na počítači

**Hotovo, když:** všechno výše funguje na tvém iPhonu přes zveřejněný web.

---

## Fáze 5 – Téma B

**B.1 Thermal energy transfers**
- [ ] **Particle model of matter** – 2D molekulová dynamika (Lennard-Jones) ve Workeru, ohřev/ochlazení, přechody pevná–kapalná–plynná, histogram E_k. *Test:* zachování energie v izolované soustavě, ekvipartice ⟨E_k⟩ = kT (2D).
- [ ] **Heating curve** – led → voda → pára, výkon ohřívače, hmotnost, c, L; graf T–t s prodlevami. *Test:* délka prodlevy = mL/P, sklon = P/(mc).
- [ ] **Black-body radiation** – Planckova křivka, Wienův zákon, Stefanův–Boltzmannův zákon, barva tělesa, presets (Slunce, člověk, žárovka, Sirius). *Test:* numerický integrál Planckovy funkce = σT⁴, λ_max·T = 2.9 × 10⁻³ m K.
- [ ] ➕ **Thermal conduction** – tyč/deska mezi lázněmi, materiál, Fourierův zákon ΔQ/Δt = kAΔT/Δx. *Test:* ustálený lineární průběh teploty a tok podle vzorce.
- [ ] ➕ **Calorimetry (method of mixtures)** – smíchání teplé a studené vody / kovu ve vodě. *Test:* výsledná teplota z bilance Σmc·ΔT = 0.

**B.2 Greenhouse effect**
- [ ] **Planetary energy balance** – solární konstanta, albedo, emisivita, model vrstvy atmosféry, presets Země/Venuše/Mars, náběh k rovnovážné teplotě. *Test:* T = [(1 − α)S/(4εσ)]^(1/4); Země α = 0.3, ε = 1 → 255 K.
- [ ] ➕ **Greenhouse photons** (kvalitativní) – viditelné a IR fotony, molekuly CO₂/H₂O/CH₄. *Test:* energetická bilance v ustáleném stavu.

**B.3 Gas laws**
- [ ] **Gas in a container** – 3D srážky částic (2D průmět) ve Workeru, píst, ohřev, tlak měřený z nárazů na stěny, teploměr, manometr. *Test:* p = NkT/V v rámci statistické chyby, ⟨½mv²⟩ = 3/2 kT, zachování energie.
- [ ] **Maxwell–Boltzmann distribution** – histogram rychlostí z simulace vs. teoretická křivka, směs plynů (He/Ne/Ar), teplota. *Test:* statistický test shody, nejpravděpodobnější, střední a efektivní rychlost.
- [ ] **Gas laws lab** – Boylův, Charlesův a Gay-Lussacův zákon s grafy, odchylka reálného plynu (van der Waals – nad rámec osnovy, označeno). *Test:* ideální vztahy; van der Waals při nízké hustotě → ideální plyn.

**B.4 Thermodynamics (HL)**
- [ ] **p–V diagram & processes** – izobarický, izochorický, izotermický, adiabatický děj; Q, W, ΔU živě. *Test:* pV^(5/3) = konst. (jednoatomový plyn), W = nRT ln(V₂/V₁), první termodynamický zákon Q = ΔU + W.
- [ ] **Heat engines & Carnot cycle** – skládání cyklů, účinnost, srovnání s Carnotem; presets Carnot, Otto, Stirling. *Test:* η_Carnot = 1 − T_c/T_h, práce = plocha cyklu.
- [ ] **Entropy** – mikrostavy (částice v přihrádkách, Ω, S = k ln Ω), volná expanze, ΔS = Q/T při tepelné výměně. *Test:* přesná kombinatorika, ΔS volné expanze = nR ln(V₂/V₁).

**B.5 Current and circuits**
- [ ] **Circuit construction kit** – zdroje s vnitřním odporem, rezistory, žárovky (neohmické), spínače, reostat, potenciometr, LDR, termistor; voltmetr a ampérmetr (ideální/reálné); animace proudu (konvenční směr/elektrony). *Test:* sériové/paralelní zapojení, 1. a 2. Kirchhoffův zákon (na 10⁻¹²), dělič napětí, vyvážený Wheatstoneův můstek, P = VI.
- [ ] **Internal resistance & emf** – měnitelná zátěž, graf V–I, směrnice = −r, průsečík = ε. *Test:* V = ε − Ir, max. výkon při R = r.
- [ ] ➕ **Resistivity** – délka, průřez a materiál drátu. *Test:* R = ρL/A.
- [ ] ➕ **I–V characteristics** – rezistor, žárovka, dioda. *Test:* ohmický prvek lineární, model žárovky konzistentní s odporem při teplotě.

**Hotovo, když:** všech 17 simulací splňuje definici hotové simulace a testy procházejí.

---

## Fáze 6 – Téma C

**C.1 Simple harmonic motion** (kyvadlo je ve fázi 1)
- [ ] **Mass–spring oscillator** – vodorovně/svisle, k, m, tlumení; grafy x, v, a s fázemi; energie. *Test:* T = 2π√(m/k), (HL) x = x₀sin(ωt + φ), posun rovnovážné polohy mg/k.
- [ ] **SHM, phase & reference circle (HL)** – fázory, dva oscilátory s fázovým rozdílem, a = −ω²x. *Test:* v = ±ω√(x₀² − x²), energie ½mω²(x₀² − x²).

**C.2 Wave model**
- [ ] **Transverse & longitudinal waves** – řetízek částic, přepínání typu, f, A, v; grafy výchylka–vzdálenost a výchylka–čas, zhuštění a zředění. *Test:* v = fλ, každá částice koná SHM.
- [ ] ➕ **Wave on a string** – pulzy, odraz na pevném/volném konci, přechod mezi dvěma strunami. *Test:* rychlost pulzu √(T/μ), obrácení fáze na pevném konci.

**C.3 Wave phenomena**
- [ ] **Reflection & refraction** – paprsek, prostředí s indexem n, Snellův zákon, mezní úhel a totální odraz, optické vlákno, úhloměr. *Test:* n₁sinθ₁ = n₂sinθ₂, sinθ_c = n₂/n₁.
- [ ] **Ripple tank** – 2D vlnová rovnice na GPU (WebGL2), bodové zdroje s fází, překážky, štěrbiny, mělčina (lom), měření dráhového rozdílu; presets ohyb na mezeře, Huygensův princip, interference dvou zdrojů. *Test:* rychlost vln v simulaci vs. nastavená (chyba < 1 %), polohy interferenčních maxim.
- [ ] **Young's double slit** – intenzita na stínítku (včetně obálky ohybu na jedné štěrbině), λ (barva), d, D, šířka štěrbiny, bílé světlo. *Test:* vzdálenost proužků s = λD/d.
- [ ] **Single slit & diffraction grating (HL)** – intenzita, první minimum θ = λ/b, mřížka nλ = d sinθ, zužování maxim s počtem štěrbin. *Test:* polohy minim a maxim z numerického výpočtu vs. vzorce.

**C.4 Standing waves and resonance**
- [ ] **Standing waves on a string** – harmonické, uzly a kmitny, napětí a lineární hustota, skládání dvou postupných vln. *Test:* f_n = nv/(2L).
- [ ] **Standing waves in pipes** – otevřená–otevřená, otevřená–zavřená, výchylka vs. tlak, přehrání zvuku. *Test:* f_n = nv/(2L) a f = (2n − 1)v/(4L).
- [ ] **Resonance & damping** – buzený tlumený oscilátor, rezonanční křivka živě, fázové zpoždění; preset Bartonova kyvadla. *Test:* ustálená amplituda podle analytického vzorce A(ω).

**C.5 Doppler effect**
- [ ] **Doppler effect** – pohyblivý zdroj i pozorovatel, vlnoplochy, frekvence, zvuk; kvalitativně SL, rovnice HL. *Test:* (HL) f′ = f·v/(v ± u_s), f′ = f·(v ± u_o)/v.
- [ ] **Shock waves** – nadzvukový zdroj, Machův kužel. *Test:* sinθ = v/u_s.
- [ ] **Redshift of light** – galaxie, posun spektrálních čar. *Test:* Δλ/λ ≈ v/c.

**Hotovo, když:** všech 14 simulací splňuje definici hotové simulace a testy procházejí.

---

## Fáze 7 – Téma D

**D.1 Gravitational fields**
- [ ] **Orbits & Kepler's laws** – planeta kolem hvězdy, počáteční rychlost, elipsa, plochy za stejný čas, graf T² vs. a³, energie (E_k, E_p, celková – HL), vektory rychlosti. *Test:* T² = 4π²a³/(GM), drift energie < 10⁻⁸ za 1000 oběhů, konstantní plošná rychlost.
- [ ] **Escape velocity & Newton's cannon (HL)** – výstřel z hory různou rychlostí. *Test:* v_esc = √(2GM/r), v_orbital = √(GM/r).
- [ ] **Gravitational field & potential (HL)** – rozmístění hmot, vektory pole, mapa potenciálu, ekvipotenciály, sonda. *Test:* g = GM/r², V_g = −GM/r, superpozice, g = −ΔV_g/Δr.
- [ ] **N-body sandbox** – tvorba těles tažením, splývání, presets (osmičkový problém tří těles, dvojhvězda, Země–Měsíc). *Test:* zachování hybnosti a energie, periodicita osmičky.

**D.2 Electric and magnetic fields** (Charges and fields je ve fázi 1)
- [ ] **Parallel plates & Millikan's oil drop** – E = V/d, vznášení kapky qE = mg, kvantování náboje. *Test:* napětí pro vznášení = mgd/q, náboje jako násobky e.
- [ ] ➕ **Magnetic field patterns** – přímý vodič, závit, cívka (solenoid), tyčový magnet, sonda-kompas. *Test:* B = μ₀I/(2πr), uvnitř solenoidu B = μ₀nI.

**D.3 Motion in electromagnetic fields**
- [ ] **Charged particle in E and B fields** – homogenní pole, q, m, v; presets: kruhový pohyb, výběr rychlosti, hmotnostní spektrometr, cyklotron. *Test:* r = mv/(qB), T = 2πm/(qB), výběr rychlosti propustí v = E/B, parabolická dráha v E.
- [ ] **Force on a conductor & between wires** – motorový efekt F = BIL sinθ, dva vodiče se přitahují/odpuzují. *Test:* F = BIL sinθ, F/L = μ₀I₁I₂/(2πr).

**D.4 Induction (HL)**
- [ ] **Magnet & coil (Faraday, Lenz)** – pohyb magnetu cívkou s N závity, grafy toku a emn, galvanometr, směr proudu, žárovka. *Test:* ε = −NΔΦ/Δt proti numerické derivaci toku, znaménko podle Lenze.
- [ ] **AC generator** – rotující cívka v poli, N, A, ω, sinusové emn, efektivní hodnota. *Test:* ε₀ = BANω, ε_rms = ε₀/√2.
- [ ] **Rod on rails** – pohybové emn BLv, proud, magnetické brzdění, mezní rychlost. *Test:* v(t) se blíží v_t = FR/(B²L²) podle analytického řešení.

**Hotovo, když:** všech 11 simulací splňuje definici hotové simulace a testy procházejí.

---

## Fáze 8 – Téma E

**E.1 Structure of the atom**
- [ ] **Rutherford scattering** – svazek α částic na jádro, záměrný parametr, Z, E_k, trajektorie, detektor a histogram podle úhlu, nejmenší vzdálenost přiblížení a poloměr jádra R = R₀A^(1/3) (HL). *Test:* tan(θ/2) = kq₁q₂/(mv²b), čelní přiblížení d = kq₁q₂/E_k, rozdělení ∝ 1/sin⁴(θ/2).
- [ ] **Atomic spectra** – výbojky (H, He, Hg, Na, Ne), emisní a absorpční spektra, spektroskop; data čar z NIST. *Test:* Balmerova série vodíku z Rydbergova vzorce vs. NIST.
- [ ] **Bohr model (HL)** – energetické hladiny, přechody, vyzáření/pohlcení fotonu, poloměry drah. *Test:* E = −13.6/n² eV, mvr = nh/(2π).

**E.2 Quantum physics (HL)**
- [ ] **Photoelectric effect** – vlnová délka a intenzita světla, výstupní práce kovu, brzdné napětí, V–A charakteristika, graf E_k,max vs. f (Planckova konstanta ze směrnice). *Test:* E_k,max = hf − Φ, mezní frekvence Φ/h.
- [ ] **Matter waves (de Broglie)** – difrakce elektronů na krystalu (kroužky), urychlovací napětí, dvouštěrbinový pokus s jednotlivými elektrony. *Test:* λ = h/p = h/√(2m_e eV).
- [ ] **Compton scattering** – srážka fotonu s elektronem, úhel, změna vlnové délky. *Test:* Δλ = h/(m_e c)·(1 − cosθ), zachování energie a hybnosti.

**E.3 Radioactive decay**
- [ ] **Random decay & half-life** – mřížka jader (i kostky), poločas (SL); rozpadová konstanta, aktivita, grafy N–t a ln N–t (HL); fluktuace, opakované běhy; presets izotopů. *Test:* (HL) střední N = N₀e^(−λt) v mezích statistické chyby, T½ = ln2/λ z proložení.
- [ ] **Binding energy per nucleon** – křivka z dat AME2020, informace o nuklidu po najetí, kalkulačka hmotnostního úbytku, oblasti štěpení a fúze. *Test:* maximum u ⁵⁶Fe/⁶²Ni ≈ 8.8 MeV, ⁴He ≈ 7.07 MeV.
- [ ] ➕ **Nuclide chart & decay modes** – graf N–Z, přeměny α, β⁻, β⁺, γ, rozpadová řada ²³⁸U. *Test:* zachování A a Z (a náboje).
- [ ] ➕ **Radiation penetration** – α, β, γ přes papír, hliník, olovo; pozadí; vzdálenost. *Test:* zákon převrácených čtverců pro γ.

**E.4 Fission**
- [ ] **Chain reaction** – jádra ²³⁵U, neutrony, kritické množství a tvar, obohacení, multiplikační faktor k. *Test:* k naměřené přes generace vs. nastavené pravděpodobnosti; ~200 MeV na štěpení.
- [ ] **Nuclear reactor** – moderátor (zpomalování neutronů), regulační tyče, chladivo, výkon, vyhořívání paliva. *Test:* bodová kinetika: k = 1 → ustálený výkon, správná odezva na zasunutí tyčí.

**E.5 Fusion and stars**
- [ ] **HR diagram** – skutečné hvězdy (veřejný katalog), log L vs. log T, čáry stejného poloměru, hlavní posloupnost, vývoj hvězd různých hmotností (kvalitativně, označeno). *Test:* čáry poloměru z L = 4πR²σT⁴, Slunce na L = L☉, T = 5772 K.
- [ ] **Stellar equilibrium** – rovnováha gravitace a tlaku záření/plynu, vychýlení a odezva (zjednodušený model, označeno). *Test:* rovnovážný poloměr modelu a stabilita.
- [ ] **Stellar parallax** – oběh Země, posun blízké hvězdy vůči pozadí, měření úhlu. *Test:* d (pc) = 1/p (″).
- [ ] ➕ **Luminosity & apparent brightness** – b = L/(4πd²), Stefanův–Boltzmannův zákon. *Test:* vzorce, Slunce → solární konstanta 1.36 kW m⁻².
- [ ] ➕ **Fusion: pp chain & Coulomb barrier** – energie uvolněná ve fúzi, proč je potřeba vysoká teplota. *Test:* uvolněná energie pp-řetězce 26.7 MeV.

**Hotovo, když:** všech 17 simulací splňuje definici hotové simulace a testy procházejí.

---

## Fáze 9 – Závěrečná kontrola a zveřejnění

- [ ] Kontrola přesnosti: každá simulace znovu proti data bookletu a průvodci osnovou (vzorce, značení, HL)
- [ ] Kompletnost rámečků *Model assumptions*
- [ ] Výkon: 60 fps na iPhonu a slabším notebooku, velikost načítaných souborů
- [ ] Přístupnost: ovládání klávesnicí, kontrast, „omezit pohyb“
- [ ] Offline režim (PWA) na iPhonu
- [ ] README: jak web spustit, upravit a nasadit
- [ ] Všechny testy procházejí, finální nasazení na GitHub Pages

**Hotovo, když:** všechny body v tomto souboru jsou odškrtnuté, testy procházejí, web běží plynule
na počítači i mobilu a je zveřejněný.

---

## Otevřené body k potvrzení

1. **Název webu:** pracovní název *Physics Lab* → adresa `https://<github-jmeno>.github.io/physics-lab/`.
   Do názvu nedávám „IB“ (je to ochranná známka IBO); „for IB Physics HL“ bude v podtitulu.
2. **GitHub jméno** a **e-mail pro commity** – doporučuji GitHub „noreply“ adresu, aby tvůj
   e-mail nebyl veřejně v historii repozitáře.
3. **Data booklet** – hotovo, zkopírován do `reference/` (do gitu se nenahrává kvůli autorským
   právům IBO). Pokud máš i **Physics guide** (průvodce osnovou), ulož ho tam taky – zpřesní,
   co přesně se v každém podtématu učí (booklet obsahuje jen rovnice). Není to nutné.
