import os
import pandas as pd
import openpyxl
from datetime import datetime, date
import re
import logging
from typing import Tuple, Dict, List, Union
from utils.validators import FileValidator, DataValidator
from services.config_service import config_service

logger = logging.getLogger(__name__)


class FileProcessorService:
    """Service pour le traitement des fichiers Sage X3"""

    def __init__(self):
        # Configuration des colonnes Sage X3 depuis le fichier externe
        self.SAGE_COLUMNS = config_service.get_sage_columns()
        self.SAGE_COLUMN_NAMES_ORDERED = list(self.SAGE_COLUMNS.keys())
        self.validation_config = config_service.get_validation_config()
        self.processing_config = config_service.get_processing_config()
        self.lot_patterns = config_service.get_lot_patterns()

        # Référence au service de session pour accéder aux DataFrames sauvegardés
        from services.session_service import SessionService

        self.session_service = SessionService()

        # Patterns pour les différents types de lots (depuis la configuration)
        self.LOT_PATTERNS = {
            "type1": self.lot_patterns.get(
                "type1_pattern", r"^([A-Z0-9]{5})(\d{6})([A-Z0-9]{4})$"
            ),
            "type2": self.lot_patterns.get("type2_pattern", r"^LOT(\d{6})$"),
        }
        
        # Liste des codes de site valides pour priorité 1
        self.PRIORITY1_SITE_CODES = set(config_service._config.get('sage_x3', {}).get('priority1_site_codes', []))
        
        logger.info(
            f"FileProcessorService initialisé avec {len(self.SAGE_COLUMN_NAMES_ORDERED)} colonnes attendues"
        )
        logger.info(f"Colonnes: {self.SAGE_COLUMN_NAMES_ORDERED}")
        logger.info(f"Codes de site priorité 1: {len(self.PRIORITY1_SITE_CODES)} codes chargés")

    def reload_config(self):
        """Recharge la configuration depuis le fichier externe"""
        config_service.reload_config()
        self.SAGE_COLUMNS = config_service.get_sage_columns()
        self.SAGE_COLUMN_NAMES_ORDERED = list(self.SAGE_COLUMNS.keys())
        self.validation_config = config_service.get_validation_config()
        self.processing_config = config_service.get_processing_config()
        self.lot_patterns = config_service.get_lot_patterns()
        logger.info("Configuration rechargée depuis le fichier externe")

    def validate_completed_template(self, file) -> Tuple[bool, str, List[str]]:
        """Valide le fichier template complété"""
        try:
            # Vérifier l'extension
            filename = file.filename
            if not filename.lower().endswith(('.xlsx', '.xls')):
                return False, "Format de fichier non supporté. Utilisez Excel (.xlsx ou .xls)", []
            
            # Lire le contenu du fichier en mémoire
            file.seek(0)
            file_content = file.read()
            file.seek(0)  # Remettre le curseur au début
            
            if len(file_content) == 0:
                return False, "Fichier vide", []
            
            logger.info(f"Validation fichier: {filename}, taille: {len(file_content)} bytes")
            
            # Vérifier que c'est un fichier ZIP valide (Excel = ZIP)
            import zipfile
            import io
            try:
                with zipfile.ZipFile(io.BytesIO(file_content), 'r') as zip_ref:
                    file_list = zip_ref.namelist()
                    # Vérifier la présence de fichiers Excel essentiels
                    required_excel_files = ['xl/workbook.xml', '[Content_Types].xml']
                    missing_files = [f for f in required_excel_files if f not in file_list]
                    if missing_files:
                        return False, f"Fichier Excel invalide, fichiers manquants: {missing_files}", []
            except zipfile.BadZipFile:
                return False, "Fichier Excel corrompu (pas un ZIP valide)", []
            
            # Tester la lecture avec pandas
            try:
                df = pd.read_excel(io.BytesIO(file_content), engine='openpyxl')
                logger.info(f"Lecture réussie: {len(df)} lignes, {len(df.columns)} colonnes")
            except Exception as pandas_error:
                logger.error(f"Erreur lecture pandas: {pandas_error}")
                return False, f"Erreur lecture fichier Excel: {pandas_error}", []
            
            # Vérifier les colonnes requises
            required_columns = ['Code Article', 'Numéro Inventaire', 'Quantité Théorique', 'Quantité Réelle']
            missing_columns = [col for col in required_columns if col not in df.columns]
            
            if missing_columns:
                return False, f"Colonnes manquantes: {', '.join(missing_columns)}", missing_columns
            
            # Vérifier qu'il y a des données
            if df.empty:
                return False, "Le fichier ne contient aucune donnée", []
            
            return True, "Fichier valide", []
                    
        except Exception as e:
            logger.error(f"Erreur validation template complété: {e}")
            return False, f"Erreur validation: {e}", []

    def detect_file_format(self, filepath: str) -> Tuple[bool, str, Dict]:
        """Détecte automatiquement le format du fichier et sa structure"""
        try:
            file_extension = os.path.splitext(filepath)[1].lower()

            if file_extension == ".csv":
                return self._detect_csv_format(filepath)
            elif file_extension in [".xlsx", ".xls"]:
                return self._detect_xlsx_format(filepath)
            else:
                return False, "Extension non supportée", {}

        except Exception as e:
            logger.error(f"Erreur détection format: {e}")
            return False, str(e), {}

    def _detect_csv_format(self, filepath: str) -> Tuple[bool, str, Dict]:
        """Détecte le format d'un fichier CSV"""
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                lines = [line.strip() for line in f.readlines()[:10] if line.strip()]

            format_info = {
                "total_lines": len(lines),
                "e_lines": [i for i, line in enumerate(lines) if line.startswith("E;")],
                "l_lines": [i for i, line in enumerate(lines) if line.startswith("L;")],
                "s_lines": [i for i, line in enumerate(lines) if line.startswith("S;")],
                "columns_per_line": [],
            }

            for i, line in enumerate(lines):
                cols = len(line.split(";"))
                format_info["columns_per_line"].append(cols)
                logger.info(f"Ligne {i+1}: {cols} colonnes - {line[:100]}...")

            return True, "Format détecté", format_info

        except Exception as e:
            return False, str(e), {}

    def _detect_xlsx_format(self, filepath: str) -> Tuple[bool, str, Dict]:
        """Détecte le format d'un fichier XLSX"""
        try:
            df = pd.read_excel(filepath, header=None, dtype=str, engine="openpyxl")

            format_info = {
                "total_rows": len(df),
                "total_cols": len(df.columns),
                "sample_data": [],
            }

            for i, row in df.head(10).iterrows():
                row_data = [
                    str(val).strip() if pd.notna(val) else "" for val in row.values
                ]
                format_info["sample_data"].append(
                    {
                        "row": i + 1,
                        "columns": len([x for x in row_data if x]),
                        "first_col": row_data[0] if row_data else "",
                        "data": row_data[:5],
                    }
                )
                logger.info(
                    f"Ligne {i+1}: {len(row_data)} colonnes - Première: '{row_data[0] if row_data else ''}' - Données: {row_data[:5]}"
                )

            return True, "Format détecté", format_info

        except Exception as e:
            return False, str(e), {}

    def validate_and_process_sage_file(
        self, filepath: str, file_extension: str, session_creation_timestamp: datetime
    ) -> Tuple[bool, Union[str, pd.DataFrame], List[str], Union[date, None]]:
        """
        Valide et traite un fichier Sage X3
        """
        try:
            # Validation sécurisée du fichier
            # Validation de l'existence du fichier
            if not os.path.exists(filepath):
                return False, "Fichier non trouvé", [], None

            # Validation de la taille du fichier
            file_size = os.path.getsize(filepath)
            max_size = 16 * 1024 * 1024  # 16MB
            if file_size > max_size:
                return (
                    False,
                    f"Fichier trop volumineux ({file_size / 1024 / 1024:.1f}MB > {max_size / 1024 / 1024:.1f}MB)",
                    [],
                    None,
                )

            if file_size == 0:
                return False, "Fichier vide", [], None

            headers = []
            data_rows = []
            original_s_lines_raw = []
            first_s_line_numero_inventaire = None

            expected_num_cols_for_data = len(self.SAGE_COLUMN_NAMES_ORDERED)

            if file_extension == ".csv":
                success, data, headers, inventory_date = self._process_csv_file(
                    filepath, expected_num_cols_for_data, session_creation_timestamp
                )
            elif file_extension in [".xlsx", ".xls"]:
                success, data, headers, inventory_date = self._process_xlsx_file(
                    filepath, expected_num_cols_for_data, session_creation_timestamp
                )
            else:
                return False, "Extension de fichier non supportée", [], None

            if not success:
                return False, data, [], None

            # Validation des données métier
            is_valid, validation_msg = DataValidator.validate_sage_structure(
                data, self.SAGE_COLUMNS
            )
            if not is_valid:
                return False, validation_msg, [], None

            return True, data, headers, inventory_date

        except Exception as e:
            logger.error(f"Erreur traitement fichier: {str(e)}", exc_info=True)
            from utils.error_handler import ErrorSanitizer

            sanitized_error = ErrorSanitizer.sanitize_error_message(
                e, include_type=False
            )
            return False, sanitized_error, [], None

    def _process_csv_file(
        self, filepath: str, expected_cols: int, session_timestamp: datetime
    ) -> Tuple[bool, Union[str, pd.DataFrame], List[str], Union[date, None]]:
        """Traite un fichier CSV"""
        headers = []
        data_rows = []
        original_s_lines_raw = []
        first_s_line_numero_inventaire = None

        try:
            with open(filepath, "r", encoding="utf-8") as f:
                for i, line in enumerate(f):
                    line = line.strip()
                    if not line:
                        continue

                    if line.startswith("E;") or line.startswith("L;"):
                        headers.append(line)
                    elif line.startswith("S;"):
                        parts = line.split(";")

                        if len(parts) < expected_cols:
                            return (
                                False,
                                f"Ligne {i+1} : Format invalide. {expected_cols} colonnes requises.",
                                [],
                                None,
                            )

                        if first_s_line_numero_inventaire is None:
                            first_s_line_numero_inventaire = parts[
                                self.SAGE_COLUMNS["NUMERO_INVENTAIRE"]
                            ]

                        processed_parts = parts[:expected_cols]
                        if len(processed_parts) < expected_cols:
                            processed_parts.extend(
                                [""] * (expected_cols - len(processed_parts))
                            )

                        data_rows.append(processed_parts)
                        original_s_lines_raw.append(";".join(processed_parts))

            if not data_rows:
                return False, "Aucune donnée S; trouvée", [], None

            # Créer le DataFrame
            df = pd.DataFrame(data_rows, columns=self.SAGE_COLUMN_NAMES_ORDERED)
            df = self._process_dataframe(df, original_s_lines_raw)

            # Extraire la date d'inventaire
            inventory_date = self._extract_inventory_date(
                first_s_line_numero_inventaire, session_timestamp
            )

            return True, df, headers, inventory_date

        except Exception as e:
            logger.error(f"Erreur traitement CSV: {e}")
            from utils.error_handler import ErrorSanitizer

            sanitized_error = ErrorSanitizer.sanitize_error_message(
                e, include_type=False
            )
            return False, sanitized_error, [], None

    def _process_xlsx_file(
        self, filepath: str, expected_cols: int, session_timestamp: datetime
    ) -> Tuple[bool, Union[str, pd.DataFrame], List[str], Union[date, None]]:
        """Traite un fichier XLSX"""
        headers = []
        data_rows = []
        original_s_lines_raw = []
        first_s_line_numero_inventaire = None

        try:
            # Lecture du fichier Excel avec gestion d'erreurs améliorée
            try:
                temp_df = pd.read_excel(
                    filepath, header=None, dtype=str, engine="openpyxl"
                )
            except Exception as e:
                logger.error(f"Erreur lecture Excel avec openpyxl: {e}")
                # Fallback: uniquement pour les anciens fichiers .xls
                ext = os.path.splitext(filepath)[1].lower()
                if ext == ".xls":
                    try:
                        temp_df = pd.read_excel(
                            filepath, header=None, dtype=str, engine="xlrd"
                        )
                    except Exception as e2:
                        logger.error(f"Erreur lecture Excel avec xlrd: {e2}")
                        return (
                            False,
                            f"Impossible de lire le fichier Excel .xls: {str(e2)}",
                            [],
                            None,
                        )
                else:
                    return (
                        False,
                        f"Impossible de lire le fichier Excel .xlsx avec openpyxl: {str(e)}",
                        [],
                        None,
                    )

            logger.info(f"Fichier Excel lu avec succès. Dimensions: {temp_df.shape}")
            logger.info(f"Premières lignes du fichier:")
            for i, row in temp_df.head(5).iterrows():
                logger.info(f"Ligne {i}: {list(row.values)}")

            for i, row_series in temp_df.iterrows():
                parts = [
                    str(val).strip() if pd.notna(val) else ""
                    for val in row_series.iloc[: max(self.SAGE_COLUMNS.values()) + 1]
                ]

                if not parts:
                    continue

                line_type = (
                    parts[self.SAGE_COLUMNS["TYPE_LIGNE"]]
                    if len(parts) > self.SAGE_COLUMNS["TYPE_LIGNE"]
                    else ""
                )
                logger.debug(
                    f"Ligne {i+1}: Type='{line_type}', Colonnes={len(parts)}, Contenu: {parts[:5]}..."
                )

                if line_type in ["E", "L"]:
                    headers.append(";".join(parts))
                elif line_type == "S":
                    if len(parts) < expected_cols:
                        logger.error(
                            f"Ligne {i+1} (S;): Format invalide. {expected_cols} colonnes requises, {len(parts)} trouvées."
                        )
                        logger.error(f"Contenu de la ligne: {parts}")
                        return (
                            False,
                            f"Ligne {i+1} (S;): Format invalide. {expected_cols} colonnes requises, {len(parts)} trouvées.",
                            [],
                            None,
                        )

                    processed_parts = parts[:expected_cols]
                    if len(processed_parts) < expected_cols:
                        processed_parts.extend(
                            [""] * (expected_cols - len(processed_parts))
                        )

                    if first_s_line_numero_inventaire is None:
                        first_s_line_numero_inventaire = processed_parts[
                            self.SAGE_COLUMNS["NUMERO_INVENTAIRE"]
                        ]

                    data_rows.append(processed_parts)
                    original_s_lines_raw.append(";".join(processed_parts))

            if not data_rows:
                return False, "Aucune donnée S; trouvée dans le fichier XLSX", [], None

            logger.info(
                f"Traitement terminé. {len(data_rows)} lignes de données S; trouvées."
            )

            # Créer le DataFrame
            df = pd.DataFrame(data_rows, columns=self.SAGE_COLUMN_NAMES_ORDERED)
            df = self._process_dataframe(df, original_s_lines_raw)

            # Extraire la date d'inventaire
            inventory_date = self._extract_inventory_date(
                first_s_line_numero_inventaire, session_timestamp
            )

            return True, df, headers, inventory_date

        except Exception as e:
            logger.error(f"Erreur traitement XLSX: {e}")
            from utils.error_handler import ErrorSanitizer

            sanitized_error = ErrorSanitizer.sanitize_error_message(
                e, include_type=False
            )
            return False, sanitized_error, [], None

    def _process_dataframe(
        self, df: pd.DataFrame, original_lines: List[str]
    ) -> pd.DataFrame:
        """Traite le DataFrame après création"""
        # Conversion des types + comptage pour rapport
        # Normaliser les décimaux potentiels (virgule) et retirer les espaces avant conversion
        df["QUANTITE"] = pd.to_numeric(
            df["QUANTITE"]
              .astype(str)
              .str.replace('\u00a0', '', regex=False)  # espace insécable éventuel
              .str.replace(' ', '', regex=False)       # séparateur de milliers éventuel
              .str.replace(',', '.', regex=False),     # virgule -> point
            errors="coerce"
        )
        # Tolérance pilotée par configuration: remplacer invalides par 0
        if self.processing_config.get('treat_invalid_quantity_as_zero', True):
            invalid_qty_mask = df["QUANTITE"].isna()
            if invalid_qty_mask.any():
                logging.getLogger(__name__).warning(
                    f"{invalid_qty_mask.sum()} valeurs QUANTITE invalides détectées. Remplacement par 0 activé."
                )
                df.loc[invalid_qty_mask, "QUANTITE"] = 0
                try:
                    # stocker un résumé dans la session pour l'API
                    from services.session_service import SessionService
                    examples = (
                        df.loc[invalid_qty_mask, :]
                          .head(5)
                          .to_dict('records')
                    )
                    # minimiser: ne garder que champs essentiels
                    simplified = []
                    for r in examples:
                        simplified.append({
                            'NUMERO_INVENTAIRE': r.get('NUMERO_INVENTAIRE'),
                            'CODE_ARTICLE': r.get('CODE_ARTICLE'),
                            'QUANTITE_RAW': None  # valeur brute non gardée ici car déjà convertie
                        })
                    # écrire dans un attribut temporaire sur l'instance pour récupération après
                    setattr(self, '_last_invalid_qty_count', int(invalid_qty_mask.sum()))
                    setattr(self, '_last_invalid_qty_samples', simplified)
                except Exception:
                    pass

        # Extraction des dates de lot et détection LOTECART
        lot_info = df["NUMERO_LOT"].apply(self._extract_date_from_lot)
        df["Date_Lot"] = lot_info.apply(lambda x: x[0] if x else None)
        df["Type_Lot"] = lot_info.apply(lambda x: x[1] if x else "unknown")

        # Pré-marquer les lignes avec quantité = 0 comme potentiels LOTECART
        # Ne pas pré-marquer ici, la détection LOTECART se fait lors du traitement du template complété

        # Ajout des lignes originales
        df["original_s_line_raw"] = original_lines

        return df

    def _extract_date_from_lot(
        self, lot_number: str
    ) -> Tuple[Union[datetime, None], str]:
        """
        Extrait une date d'un numéro de lot Sage X3 selon les 2 types principaux
        Type 1 (Priorité 1): 5 caractères site + DDMMYY + 4 caractères
        Retourne (date, type_lot)
        """
        if pd.isna(lot_number):
            return None, "unknown"

        lot_str = str(lot_number).strip()

        # Type 1: Lots avec 5 caractères site + date + 4 caractères (ex: CPKU1070725ABCD, CB2TV020425WXYZ)
        type1_match = re.match(self.LOT_PATTERNS["type1"], lot_str)
        if type1_match:
            site_code = type1_match.group(1)  # 5 caractères
            date_part = type1_match.group(2)  # DDMMYY
            suffix = type1_match.group(3)     # 4 caractères
            
            # Vérifier que le code de site est dans la liste des codes valides
            if site_code not in self.PRIORITY1_SITE_CODES:
                logger.debug(f"Code de site {site_code} non reconnu comme priorité 1")
                return None, "unknown"
            
            try:
                day = int(date_part[:2])
                month = int(date_part[2:4])
                year = int(date_part[4:6]) + 2000
                
                # Validation de la date
                if not (1 <= day <= 31 and 1 <= month <= 12):
                    logger.warning(f"Date invalide dans le lot type 1: {lot_number} (jour={day}, mois={month})")
                    return None, "type1"
                
                logger.debug(f"Lot priorité 1 détecté: {site_code} + {day:02d}/{month:02d}/{year} + {suffix}")
                return datetime(year, month, day), "type1"
            except ValueError:
                logger.warning(f"Date invalide dans le lot type 1: {lot_number}")
                return None, "type1"

        # Type 2: LOT + date (ex: LOT311224)
        type2_match = re.match(self.LOT_PATTERNS["type2"], lot_str)
        if type2_match:
            # Type 2: Pas d'extraction de date, traitement sur le premier lot trouvé
            logger.debug(f"Lot type 2 détecté (sans extraction de date): {lot_number}")
            return None, "type2"  # Pas de date, juste le type

        return None, "unknown"

    def _extract_inventory_date(
        self, numero_inventaire: str, session_timestamp: datetime
    ) -> Union[date, None]:
        """Extrait la date d'inventaire du numéro d'inventaire"""
        if not numero_inventaire:
            return None

        # Pattern depuis la configuration
        pattern = self.lot_patterns.get("inventory_date_pattern", r"(\d{2})(\d{2})INV")
        match = re.search(pattern, numero_inventaire)
        if match:
            try:
                day = int(match.group(1))
                month = int(match.group(2))
                year = session_timestamp.year
                return date(year, month, day)
            except ValueError:
                logger.warning(
                    f"Date invalide dans le numéro d'inventaire: {numero_inventaire}"
                )
        return None

    def aggregate_data(self, df: pd.DataFrame) -> pd.DataFrame:
        """Agrège les données par clés métier en tenant compte des inventaires multiples"""
        try:
            if df.empty:
                raise ValueError("DataFrame vide pour l'agrégation")

            # Clés d'agrégation depuis la configuration
            aggregation_keys = self.processing_config.get(
                "aggregation_keys",
                ["CODE_ARTICLE", "STATUT", "EMPLACEMENT", "ZONE_PK", "UNITE"],
            )

            # Ajouter NUMERO_INVENTAIRE aux clés d'agrégation pour gérer les inventaires multiples
            if "NUMERO_INVENTAIRE" not in aggregation_keys:
                aggregation_keys.append("NUMERO_INVENTAIRE")

            # Filtrer les colonnes qui existent réellement dans le DataFrame
            existing_keys = [key for key in aggregation_keys if key in df.columns]
            if not existing_keys:
                raise ValueError(
                    "Aucune clé d'agrégation valide trouvée dans les données"
                )

            aggregated = (
                df.groupby(existing_keys)
                .agg(
                    Quantite_Theorique_Totale=("QUANTITE", "sum"),
                    Numero_Session=("NUMERO_SESSION", "first"),
                    Site=("SITE", "first"),
                    Date_Min=(
                        "Date_Lot",
                        lambda x: (
                            min(d for d in x if d is not None and pd.notna(d))
                            if any(d for d in x if d is not None and pd.notna(d))
                            else None
                        ),
                    ),
                    Type_Lot_Prioritaire=(
                        "Type_Lot",
                        lambda x: self._get_priority_lot_type(x.tolist()),
                    ),
                )
                .reset_index()
            )

            # Tri intelligent : d'abord par type de lot prioritaire, puis par date si disponible
            def sort_key(row):
                type_priority = {"type1": 1, "type2": 2, "lotecart": 3, "unknown": 4}
                priority = type_priority.get(row["Type_Lot_Prioritaire"], 4)
                date_value = row["Date_Min"] if pd.notna(row["Date_Min"]) else datetime.min
                return (priority, date_value)
            
            aggregated["_sort_key"] = aggregated.apply(sort_key, axis=1)
            aggregated = aggregated.sort_values("_sort_key").drop("_sort_key", axis=1)
            
            return aggregated

        except Exception as e:
            logger.error(f"Erreur d'agrégation: {str(e)}", exc_info=True)
            raise

    def _get_priority_lot_type(self, lot_types: List[str]) -> str:
        """Détermine le type de lot prioritaire selon la hiérarchie"""
        # Priorité: lots avec dates détectées > LOTECART > potential_lotecart > unknown
        priority_order = ["type1", "type2", "lotecart", "potential_lotecart", "unknown"]

        for priority_type in priority_order:
            if priority_type in lot_types:
                return priority_type

        return "unknown"

    def generate_template(
        self, aggregated_df: pd.DataFrame, session_id: str, output_folder: str
    ) -> str:
        """Génère un template Excel pour la saisie"""
        try:
            if aggregated_df.empty:
                raise ValueError(f"Aucune donnée agrégée pour la session {session_id}")

            # Récupérer les métadonnées pour le nom de fichier
            session_num = aggregated_df["Numero_Session"].iloc[0]
            site_code = aggregated_df["Site"].iloc[0]

            # Gérer les inventaires multiples pour le nom de fichier
            inventory_nums = aggregated_df["NUMERO_INVENTAIRE"].unique()
            if len(inventory_nums) == 1:
                inventory_num = inventory_nums[0]
            else:
                # Pour les inventaires multiples, utiliser le premier + indication
                inventory_num = f"{inventory_nums[0]}_MULTI"

            # Préparer les données du template avec les numéros de lot
            template_rows = []

            for _, row in aggregated_df.iterrows():
                # Récupérer les lots originaux pour cet article et cet inventaire
                original_lots = self._get_original_lots_for_article(
                    row["CODE_ARTICLE"], row["NUMERO_INVENTAIRE"], session_id
                )

                if original_lots.empty:
                    # Si pas de lots trouvés, créer une ligne avec les données agrégées
                    template_rows.append(
                        {
                            "Numéro Session": row["Numero_Session"],
                            "Numéro Inventaire": row["NUMERO_INVENTAIRE"],
                            "Code Article": row["CODE_ARTICLE"],
                            "Statut Article": row["STATUT"],
                            "Quantité Théorique": row["Quantite_Theorique_Totale"],
                            "Quantité Réelle": 0,
                            "Unites": row["UNITE"],
                            "Depots": row["ZONE_PK"],
                            "Emplacements": row["EMPLACEMENT"],
                        }
                    )
                else:
                    # Créer une ligne par lot - mais maintenant on agrège vraiment par article
                    # Plus besoin de créer une ligne par lot individuel
                    template_rows.append(
                        {
                            "Numéro Session": row["Numero_Session"],
                            "Numéro Inventaire": row["NUMERO_INVENTAIRE"],
                            "Code Article": row["CODE_ARTICLE"],
                            "Statut Article": row["STATUT"],
                            "Quantité Théorique": row["Quantite_Theorique_Totale"],
                            "Quantité Réelle": 0,
                            "Unites": row["UNITE"],
                            "Depots": row["ZONE_PK"],
                            "Emplacements": row["EMPLACEMENT"],
                        }
                    )

            template_df = pd.DataFrame(template_rows)

            # Construction du nom de fichier selon le format demandé
            filename = f"{site_code}_{session_num}_{inventory_num}_{session_id}.xlsx"
            filepath = os.path.join(output_folder, filename)

            # Écriture Excel avec formatage
            with pd.ExcelWriter(filepath, engine="openpyxl") as writer:
                template_df.to_excel(writer, index=False, sheet_name="Inventaire")

                worksheet = writer.sheets["Inventaire"]
                for column in worksheet.columns:
                    max_length = max(
                        len(str(cell.value))
                        for cell in column
                        if cell.value is not None
                    )
                    adjusted_width = min(max_length + 2, 50)
                    worksheet.column_dimensions[column[0].column_letter].width = (
                        adjusted_width
                    )

            return filepath

        except Exception as e:
            logger.error(f"Erreur génération template: {str(e)}", exc_info=True)
            raise

    def _get_original_lots_for_article(
        self, code_article: str, numero_inventaire: str, session_id: str
    ) -> pd.DataFrame:
        """Récupère les lots originaux pour un article et un inventaire donnés"""
        try:
            # Charger depuis le stockage persistant
            original_df = self.session_service.load_dataframe(session_id, "original_df")

            if original_df is None:
                logger.warning(
                    f"DataFrame original non trouvé pour session {session_id}"
                )
                return pd.DataFrame()

            # Filtrer par article et inventaire
            lots = original_df[
                (original_df["CODE_ARTICLE"] == code_article)
                & (original_df["NUMERO_INVENTAIRE"] == numero_inventaire)
            ].copy()

            return lots

        except Exception as e:
            logger.error(f"Erreur récupération lots originaux: {e}")
            return pd.DataFrame()

    # Supprimer la version filepath pour éviter les collisions de signature avec la version file utilisée dans app.py
