#!/usr/bin/env node

/**
 * Script d'analyse des bundles pour mesurer l'impact des optimisations
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const DIST_DIR = 'dist';
const ASSETS_DIR = path.join(DIST_DIR, 'assets');

function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function analyzeBundle() {
    console.log('🔍 Analyse des bundles...\n');

    try {
        // Build du projet
        console.log('📦 Construction du projet...');
        execSync('npm run build', { stdio: 'inherit' });

        // Analyse des fichiers générés
        if (!fs.existsSync(ASSETS_DIR)) {
            console.error('❌ Dossier assets non trouvé');
            return;
        }

        const files = fs.readdirSync(ASSETS_DIR);
        const jsFiles = files.filter(file => file.endsWith('.js'));
        const cssFiles = files.filter(file => file.endsWith('.css'));

        console.log('\n📊 Résultats de l\'analyse:\n');

        // Analyse des fichiers JS
        let totalJSSize = 0;
        console.log('🟨 Fichiers JavaScript:');
        jsFiles.forEach(file => {
            const filePath = path.join(ASSETS_DIR, file);
            const stats = fs.statSync(filePath);
            totalJSSize += stats.size;
            
            const type = file.includes('vendor') ? 'Vendor' : 
                        file.includes('index') ? 'Main' : 'Chunk';
            
            console.log(`  ${type.padEnd(8)} ${file.padEnd(30)} ${formatBytes(stats.size)}`);
        });

        // Analyse des fichiers CSS
        let totalCSSSize = 0;
        console.log('\n🟦 Fichiers CSS:');
        cssFiles.forEach(file => {
            const filePath = path.join(ASSETS_DIR, file);
            const stats = fs.statSync(filePath);
            totalCSSSize += stats.size;
            console.log(`  CSS      ${file.padEnd(30)} ${formatBytes(stats.size)}`);
        });

        // Résumé
        console.log('\n📈 Résumé:');
        console.log(`  JavaScript total: ${formatBytes(totalJSSize)}`);
        console.log(`  CSS total:        ${formatBytes(totalCSSSize)}`);
        console.log(`  Total:            ${formatBytes(totalJSSize + totalCSSSize)}`);

        // Recommandations
        console.log('\n💡 Recommandations:');
        if (totalJSSize > 1024 * 1024) { // > 1MB
            console.log('  ⚠️  Bundle JS volumineux (>1MB) - Considérer plus de code splitting');
        } else {
            console.log('  ✅ Taille du bundle JS acceptable');
        }

        if (jsFiles.length < 3) {
            console.log('  ⚠️  Peu de chunks - Considérer le code splitting pour de meilleures performances');
        } else {
            console.log('  ✅ Code splitting approprié');
        }

        // Génération du rapport
        const report = {
            timestamp: new Date().toISOString(),
            totalJS: totalJSSize,
            totalCSS: totalCSSSize,
            total: totalJSSize + totalCSSSize,
            files: {
                js: jsFiles.map(file => ({
                    name: file,
                    size: fs.statSync(path.join(ASSETS_DIR, file)).size
                })),
                css: cssFiles.map(file => ({
                    name: file,
                    size: fs.statSync(path.join(ASSETS_DIR, file)).size
                }))
            }
        };

        fs.writeFileSync('bundle-analysis.json', JSON.stringify(report, null, 2));
        console.log('\n📄 Rapport sauvegardé dans bundle-analysis.json');

    } catch (error) {
        console.error('❌ Erreur lors de l\'analyse:', error.message);
    }
}

// Comparaison avec un rapport précédent
function compareWithPrevious() {
    const currentReportPath = 'bundle-analysis.json';
    const previousReportPath = 'bundle-analysis-previous.json';

    if (!fs.existsSync(currentReportPath) || !fs.existsSync(previousReportPath)) {
        console.log('ℹ️  Pas de rapport précédent pour comparaison');
        return;
    }

    const current = JSON.parse(fs.readFileSync(currentReportPath, 'utf8'));
    const previous = JSON.parse(fs.readFileSync(previousReportPath, 'utf8'));

    console.log('\n📊 Comparaison avec le rapport précédent:\n');

    const jsDiff = current.totalJS - previous.totalJS;
    const cssDiff = current.totalCSS - previous.totalCSS;
    const totalDiff = current.total - previous.total;

    const formatDiff = (diff) => {
        const sign = diff >= 0 ? '+' : '';
        const percentage = previous.total > 0 ? ((diff / previous.total) * 100).toFixed(1) : '0';
        return `${sign}${formatBytes(diff)} (${sign}${percentage}%)`;
    };

    console.log(`JavaScript: ${formatBytes(current.totalJS)} (${formatDiff(jsDiff)})`);
    console.log(`CSS:        ${formatBytes(current.totalCSS)} (${formatDiff(cssDiff)})`);
    console.log(`Total:      ${formatBytes(current.total)} (${formatDiff(totalDiff)})`);

    if (totalDiff > 0) {
        console.log('\n⚠️  Le bundle a augmenté en taille');
    } else if (totalDiff < 0) {
        console.log('\n✅ Le bundle a diminué en taille');
    } else {
        console.log('\n➡️  Aucun changement de taille');
    }
}

// Exécution
if (process.argv.includes('--compare')) {
    compareWithPrevious();
} else {
    analyzeBundle();
    if (process.argv.includes('--save-previous')) {
        if (fs.existsSync('bundle-analysis.json')) {
            fs.copyFileSync('bundle-analysis.json', 'bundle-analysis-previous.json');
            console.log('💾 Rapport sauvegardé comme référence précédente');
        }
    }
}