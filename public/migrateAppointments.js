// scripts/migrateAppointments.js
// Script para agregar el campo paidToPsychologist a citas existentes

import { db } from '../backend/firebase-admin.js';

async function migrateAppointments() {
    try {
        console.log('🔄 Iniciando migración de citas...');

        // Obtener todas las citas
        const appointmentsSnapshot = await db.collection('appointments').get();
        
        console.log(`📊 Total de citas encontradas: ${appointmentsSnapshot.size}`);

        const batch = db.batch();
        let count = 0;

        appointmentsSnapshot.forEach(doc => {
            const data = doc.data();
            
            // Solo actualizar si no existe el campo
            if (data.paidToPsychologist === undefined) {
                batch.update(doc.ref, {
                    paidToPsychologist: false,
                    psychologistPaymentId: null,
                    psychologistPaidAt: null
                });
                count++;
            }
        });

        if (count > 0) {
            await batch.commit();
            console.log(`✅ Migración completada: ${count} citas actualizadas`);
        } else {
            console.log('ℹ️ No hay citas para migrar');
        }

        console.log('🎉 Proceso finalizado exitosamente');
        process.exit(0);

    } catch (error) {
        console.error('❌ Error en la migración:', error);
        process.exit(1);
    }
}

// Ejecutar migración
migrateAppointments();