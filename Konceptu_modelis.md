# Konceptu modelis

Konceptu modelis ir balstīts uz prasību formulējumu (reģistrācija, diētas plānošana, kaloriju aprēķins, dzīvesveida analīze, filtrēšana).

## 1. Diagramma



```mermaid
classDiagram
    direction LR

    class Lietotajs {
        +int id
        +String vārds
        +String e_pasts
        +String paroles_hešs
        +String loma
        +DateTime reģistrācijas_datums
    }

    class Profils {
        +int vecums
        +String dzimums
        +int augums_cm
        +float svars_kg
        +String aktivitātes_līmenis
        +String mērķis
        +int dienas_kaloriju_mērķis
    }

    class DietasPlans {
        +int id
        +String nosaukums
        +String veids
        +Date sākuma_datums
        +Date beigu_datums
        +int kaloriju_mērķis
    }

    class Edienreize {
        +Date diena
        +String tips
        +int porcijas
    }

    class Recepte {
        +int id
        +String nosaukums
        +String apraksts
        +String pagatavošanas_soļi
        +int porciju_skaits
        +float kalorijas_porcijā
    }

    class ReceptesSastavdala {
        +float daudzums_g
    }

    class Produkts {
        +int id
        +String nosaukums
        +float kcal_100g
        +float olbaltumvielas_100g
        +float tauki_100g
        +float ogļhidrāti_100g
    }

    class Birka {
        +String nosaukums
    }

    class AnalizesSesija {
        +DateTime datums_laiks
        +String statuss
        +String piezīmes
    }

    Lietotajs "1" -- "1" Profils : ir
    Lietotajs "1" -- "*" DietasPlans : izveido
    DietasPlans "*" --> "0..1" DietasPlans : balstīts uz veidni
    DietasPlans "1" *-- "*" Edienreize : sastāv no
    Edienreize "*" --> "1" Recepte : izmanto
    Recepte "1" *-- "*" ReceptesSastavdala : satur
    ReceptesSastavdala "*" --> "1" Produkts : norāda
    Recepte "*" -- "*" Birka : marķēta ar
    Profils "*" -- "*" Birka : vēlamais diētas veids
    Profils "*" -- "*" Produkts : izslēgti produkti
    Lietotajs "1" -- "*" AnalizesSesija : piesaka (klients)
    Lietotajs "1" -- "*" AnalizesSesija : vada (nutriciologs)
    AnalizesSesija "*" --> "0..1" DietasPlans : iesaka
```

## 2. Konceptu apraksts

| Koncepts | Apraksts | Saistītā prasība |
|---|---|---|
| Lietotājs | Sistēmas lietotājs ar lomu: klients, nutriciologs vai administrators | 1.1 (Reģistrācija) |
| Profils | Klienta fiziskie dati, mērķis, vēlamie diētas veidi un izslēgtie produkti; tiek saglabāts pēc reģistrācijas | 1.1 (Reģistrācija), 1.3 (Diētas plānošana) |
| Diētas plāns | Ēdienreižu kopums noteiktam periodam. Veidne ir gatavs plāns, ko klients var izvēlēties. Personīgs plāns ir klienta kopija, ko var modificēt | 1.3 (Diētas plānošana) |
| Ēdienreize | Viena konkrēta ēdienreize plānā (diena + tips) ar izvēlēto recepti un porciju skaitu | 1.3 (Diētas plānošana) |
| Recepte | Ēdiens ar pagatavošanas aprakstu un sastāvdaļām | 1.3 (Diētas plānošana), 1.5 (Filtrēšana) |
| Receptes sastāvdaļa | Saista recepti ar produktu un norāda daudzumu gramos | 1.2 (Kaloriju rēķināšana) |
| Produkts | Pamatprodukts ar uzturvērtību uz 100 g | 1.2 (Kaloriju rēķināšana) |
| Birka | Marķējums filtrēšanai (piem., veģetārs), kas tiek izmantots gan receptēm, gan klienta preferencēm | 1.5 (Filtrēšana) |
| Analīzes sesija | Klienta pieteikums dzīvesveida analīzei pie nutriciologa; rezultātā var tikt ieteikts plāns | 1.4 (Dzīvesveida analīze) |

## 3. Aprēķinātie lielumi

Kalorijas netiek glabātas ar roku — tās aprēķina no datiem:

- **Receptes kalorijas** = Σ (sastāvdaļas daudzums_g / 100 × produkta kcal_100g)
- **Porcijas kalorijas** = receptes kalorijas / porciju skaits
- **Plāna dienas kalorijas** = Σ (ēdienreizes porcijas × porcijas kalorijas) attiecīgajā dienā
- **Dienas kaloriju mērķis** profilā tiek aprēķināts no vecuma, dzimuma, auguma, svara, aktivitātes līmeņa un mērķa (piem., ar Mifflin–St Jeor formulu)

## 4. Lietotāju stāstu pārklājums

| Nr. | Lietotāju stāsts | Koncepti |
|---|---|---|
| 1 | Apskatīt tikai veģetārās opcijas | Recepte, Birka |
| 2 | Reģistrēties un saglabāt preferences | Lietotājs, Profils, Birka, Produkts |
| 3 | Saplānot diētu | Diētas plāns, Ēdienreize, Recepte |
| 4 | Analizēt diētu un izvēlēties labāko plānu | Analīzes sesija, Diētas plāns |
| 5 | Aprēķināt maltītes kalorijas | Recepte, Receptes sastāvdaļa, Produkts |
