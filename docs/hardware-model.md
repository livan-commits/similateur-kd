# Profil matériel de référence — Kode Dot DVT

Date de vérification : 2026-11-14

Ce profil est extrait des sources du SDK officiel réellement épinglé par KodeOS :
`kodediy/kode-sdk@1841cc8c13d4b2e3e4d7288b40cdac5de207a133`.

Sources de référence :
- `components/kbsp/board/include/kbsp_pins.h`
- `components/kbsp/board/include/kbsp_board.h`
- `components/kbsp/partitions.csv`
- `components/kdrv/*` (pilotes matériels)
- [ESP-EMU v1.0.0](https://github.com/espressif/esp-emulator/tree/v1.0.0)
- [Contrat des Virtual Parts ESP-EMU](https://github.com/espressif/esp-emulator/blob/v1.0.0/docs/guides/PARTS.md)

## Carte et processeurs

| Propriété | Valeur officielle |
|---|---|
| Produit / révision | Kode Dot / DVT |
| SoC principal | ESP32-P4 |
| Coprocesseur | ESP32-C5 |
| Liaison P4–C5 | ESP-Hosted sur SDIO 4 bits |
| Écran | CO5300 AMOLED, MIPI-DSI, 410 × 502 px |
| Rayon de coin écran | 114 px |
| Horloge principale | 40 MHz |
| Cristal RTC | 32,768 kHz |

## Bus I2C principal

- SDA : GPIO 4
- SCL : GPIO 5
- Fréquence : 400 kHz
- Contrôleur : I2C0

| Adresse | Composant | Fonction |
|---:|---|---|
| 0x30 | KTD2026 | LED RGB |
| 0x20 | TCA6408A | Expandeur GPIO 8 bits |
| 0x6A | QMI8658A | IMU |
| 0x2C | QMC5883P | Magnétomètre |
| 0x0C | QMC5883P | Adresse alternative observée au démarrage |
| 0x18 | ES8311 | Codec audio |
| 0x6B | BQ25896 | Chargeur / gestion alimentation |
| 0x64 | CW2217 | Jauge batterie |
| 0x15 | CST820 | Contrôleur tactile |
| 0x5A | AW86233 | Pilote haptique |

Le pilote du SDK mentionne aussi le comportement d'adresse alternative du QMC5883P. Le modèle devra donc pouvoir répondre à l'adresse réellement observée, sans répondre artificiellement aux deux adresses en même temps.

## Expandeur TCA6408A (adresse 0x20)

| Bit | Signal |
|---:|---|
| P0 | Bouton bas / QON |
| P1 | Pavé haut |
| P2 | Pavé gauche |
| P3 | Pavé bas |
| P4 | Pavé droit |
| P5 | Interruption IMU |
| P6 | Interruption tactile |
| P7 | Alimentation écran (sortie) |

Autres commandes physiques :
- Bouton supérieur direct : GPIO 35
- Reset écran + tactile, actif bas : GPIO 7
- Interruption expandeur : GPIO 6

## Bus SPI NFC

Le NFC ST25R3916B est raccordé en SPI mode 1 :
- CS : GPIO 28
- IRQ : GPIO 29
- SCK : GPIO 30
- MOSI : GPIO 31
- MISO : GPIO 32
- Contrôleur : SPI2_HOST (identifiant SDK 1)

## Autres interfaces matérielles

| Fonction | Affectation |
|---|---|
| microSD | SDMMC0, D0=39, D1=40, D2=41, D3=42, CLK=43, CMD=44 |
| Alimentation microSD | GPIO 22 |
| USB Serial/JTAG | DM=24, DP=25 |
| Dock UART | TX=26, RX=27 |
| Audio I2S | MCLK=36, SCLK=34, ASDOUT=33, LRCK=37, DSDIN=38 |
| IR sur C5 | TX=GPIO24, RX=GPIO23 |
| C5 enable | P4 GPIO 23 |
| C5 wake P4 | P4 GPIO 2 |
| C5 SDIO | D0=49, D1=48, D2=53, D3=52, CLK=50, CMD=51 |
| RFID | PULL=45, CARRIER=46, RF_IN=54, OUT=47 |
| Header J3 | GPIO 8–21 selon le brochage détaillé du SDK |

## Ce que le moteur ESP-EMU peut réellement modéliser dans le navigateur

ESP-EMU v1.0.0 annonce les SoC ESP32-P4 et ESP32-C5 et un runtime WebAssembly navigateur. Son mécanisme Virtual Parts documenté permet actuellement des composants virtuels sur :
- GPIO (entrées, sorties, interruptions selon le modèle) ;
- I2C (adresses et transactions) ;
- SPI (chip-select et transactions).

Une page personnalisée peut charger un module `.wasm` par composant via `part-worker.js` et `CosimPump`. Les pages de démonstration standard ne chargent que leurs exemples bouton et SHT31 : elles ne constituent pas un simulateur Kode Dot prêt à l'emploi.

### Modèles candidats à écrire

| Priorité | Composant | Interface | Critère de validation |
|---:|---|---|---|
| 1 | TCA6408A | I2C + GPIO | registres direction/entrée/sortie, boutons et IRQ cohérents |
| 2 | CST820 | I2C + IRQ | registres d'identification et rapports tactiles plausibles |
| 3 | QMI8658A | I2C + IRQ | identité, configuration, données accéléro/gyro cohérentes |
| 4 | QMC5883P | I2C | identité, données magnétiques et gestion d'adresse |
| 5 | KTD2026 | I2C | registres LED et état RGB |
| 6 | BQ25896 / CW2217 | I2C | registres alimentation et batterie simulés |
| 7 | AW86233 | I2C | commandes haptiques et état |
| 8 | ST25R3916B | SPI + IRQ | registres, FIFO et transactions NFC minimales |

Chaque modèle devra être vérifié par des tests unitaires sur ses transactions et par des traces de bus issues du pilote KodeOS. Des registres factices qui acquittent tout ne seront pas présentés comme une émulation fonctionnelle.

## Limites bloquantes identifiées

1. **MIPI-DSI / CO5300** : le contrat Virtual Parts v1.0.0 ne décrit que GPIO, I2C et SPI. Il ne fournit pas à lui seul un écran MIPI-DSI. Il faudra vérifier si le SoC emulator expose un contrôleur DSI utilisable par le firmware ; sinon, un pont d'affichage spécifique sera nécessaire.
2. **Audio I2S** : aucune interface de part I2S n'est documentée dans le contrat actuel.
3. **microSD / SDMMC** : pas de part SDMMC documentée dans le contrat actuel.
4. **P4–C5 / ESP-Hosted SDIO** : la documentation Hosted v1.0.0 décrit un pont natif P4–C6 sur socket Unix, pas un pont navigateur P4–C5. La paire du Kode Dot n'est donc pas considérée comme intégrée.
5. **Firmware KodeOS** : la réussite du simulateur KGUI ou le chargement d'un firmware ESP32 générique ne prouve pas que l'image KodeOS démarre ni que ses Active Objects fonctionnent.

## Ordre de réalisation

1. Établir un profil de broches et bus vérifiable (ce document).
2. Construire un premier modèle TCA6408A et le tester avec des transactions unitaires.
3. Construire les modèles I2C du tactile et des capteurs, avec les registres tirés des fiches techniques et des pilotes officiels.
4. Créer une page navigateur dédiée au Kode Dot qui charge les parts via le mécanisme documenté ESP-EMU.
5. Trouver et construire une image flash KodeOS P4 reproductible, puis tester le démarrage.
6. Étudier séparément DSI, I2S, SDMMC et le pont SDIO P4–C5.
7. Ne déclarer l'émulation complète qu'après tests de boot, d'Active Objects, de services et de périphériques.


## État du simulateur Windows hors ligne — 15 novembre 2026

- Le firmware ESP32-C5 peut être lancé à la demande dans une seconde instance ESP-EMU. Cette instance reste **autonome** : aucun transport SDIO P4–C5 n'est actuellement fourni par les Virtual Parts navigateur d'ESP-EMU v1.0.0. Le bouton de démarrage ne doit donc pas être interprété comme une liaison coprocesseur fonctionnelle.
- Le dossier `Carte_SD` persiste dans le répertoire `userData` de l'application Windows. L'interface permet maintenant l'import de fichiers ou de dossiers, l'export et la suppression ; les sous-dossiers sont conservés. Les chemins sont confinés à ce dossier et les liens symboliques sont refusés.
- Ce stockage est une **bibliothèque de fichiers côté hôte**, pas une carte SDMMC émulée. Le firmware ESP32-P4 ne peut pas monter ni lire ces fichiers, car ESP-EMU v1.0.0 ne fournit pas d'interface SDMMC Virtual Part. Aucune image FAT n'est présentée comme montée par KodeOS.

Pour raccorder réellement ces deux interfaces, il faut étendre le moteur ESP-EMU ou ajouter une couche d'émulation bas niveau testée pour SDIO/SDMMC, puis valider les transactions avec les pilotes du SDK KodeOS épinglé. Un pont UART ou un partage de fichiers côté interface ne serait pas un substitut fidèle à ces bus.