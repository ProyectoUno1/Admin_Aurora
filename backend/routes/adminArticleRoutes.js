// adminArticleRoutes.js
import express from "express";
import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../firebase-admin.js';
import { verifyFirebaseToken } from '../middlewares/auth_middleware.js';

const adminArticleRouter = express.Router();

// Middleware para verificar que es un usuario autenticado
adminArticleRouter.use(verifyFirebaseToken);

// Función helper para verificar si el usuario es admin
const verifyIsAdmin = async (userId) => {
  try {
    const adminDoc = await db.collection('administrators').doc(userId).get();
    if (!adminDoc.exists) {
      const adminsSnapshot = await db.collection('administrators').limit(5).get();
      
      if (!adminsSnapshot.empty) {
        adminsSnapshot.forEach(doc => {
          console.log(`   - ID: ${doc.id}, Data:`, doc.data());
        });
      }
      
      throw new Error(`No es administrador. UID: ${userId} no encontrado en colección 'administrators'`);
    }
    
    const adminData = adminDoc.data();
    
    // Verificar si tiene el campo isActive y si está desactivado
    if (adminData.hasOwnProperty('isActive') && adminData.isActive === false) {
      throw new Error('Cuenta de administrador desactivada');
    }
    
    console.log('Usuario verificado como administrador');
    return adminData;
  } catch (error) {
    console.error('Error en verificación de admin:', error.message);
    throw error;
  }
};

adminArticleRouter.get("/debug/user", async (req, res) => {
  try {

    const adminData = await verifyIsAdmin(req.userId);
    
    res.json({
      success: true,
      message: 'Usuario es administrador válido',
      userId: req.userId,
      adminData: adminData,
      firebaseUser: {
        uid: req.firebaseUser.uid,
        email: req.firebaseUser.email,
        email_verified: req.firebaseUser.email_verified
      }
    });
  } catch (adminError) {
    res.status(403).json({ 
      error: adminError.message,
      userId: req.userId,
      firebaseUser: req.firebaseUser ? {
        uid: req.firebaseUser.uid,
        email: req.firebaseUser.email
      } : null
    });
  }
});

// Obtener estadísticas de artículos
adminArticleRouter.get("/articles/stats/overview", async (req, res) => {
  try {
    await verifyIsAdmin(req.userId);
  } catch (adminError) {
    return res.status(403).json({ error: adminError.message });
  }

  try {
    const articlesSnapshot = await db.collection('articles').get();
    
    const stats = {
      total: 0,
      published: 0,
      draft: 0,
      archived: 0,
      deleted: 0,
      totalViews: 0,
      totalLikes: 0,
      topCategories: {},
      recentActivity: []
    };

    const recentArticles = [];

    articlesSnapshot.docs.forEach(doc => {
      const data = doc.data();
      stats.total++;
      
      // Contar por estado
      switch (data.status) {
        case 'published': stats.published++; break;
        case 'draft': stats.draft++; break;
        case 'archived': stats.archived++; break;
        case 'deleted': stats.deleted++; break;
        default:
          
          if (data.isPublished) {
            stats.published++;
          } else {
            stats.draft++;
          }
      }

      // Sumar vistas y likes
      stats.totalViews += data.views || 0;
      stats.totalLikes += data.likes || 0;

      // Contar categorías
      if (data.category) {
        stats.topCategories[data.category] = (stats.topCategories[data.category] || 0) + 1;
      }

      // Recopilar artículos recientes
      if (data.createdAt) {
        recentArticles.push({
          id: doc.id,
          title: data.title,
          status: data.status || (data.isPublished ? 'published' : 'draft'),
          psychologistName: data.psychologistName,
          createdAt: data.createdAt.toDate()
        });
      }
    });

    // Ordenar y limitar actividad reciente
    stats.recentActivity = recentArticles
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 10);

    // Convertir topCategories a array ordenado
    stats.topCategories = Object.entries(stats.topCategories)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([category, count]) => ({ category, count }));

    res.json(stats);

  } catch (error) {
    console.error(" Error obteniendo estadísticas:", error);
    res.status(500).json({
      error: "Error al obtener estadísticas",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Obtener todos los artículos para administración
adminArticleRouter.get("/articles", async (req, res) => {
  try {
    // Verificar que es admin
    await verifyIsAdmin(req.userId);
  } catch (adminError) {
    console.error('Error verificación admin en articles:', adminError.message);
    return res.status(403).json({ error: adminError.message });
  }

  const { 
    status = 'all', 
    limit = 20, 
    page = 1, 
    search,
    category,
    psychologistId,
    orderBy = 'createdAt',
    order = 'desc'
  } = req.query;

  try {
    
    let query = db.collection('articles');

    // Filtrar por estado
    if (status !== 'all' && ['draft', 'published', 'archived', 'deleted'].includes(status)) {
      query = query.where('status', '==', status);
    } else if (status === 'published' && status !== 'all') {
      // Fallback para artículos que usan isPublished en lugar de status
      query = query.where('isPublished', '==', true);
    }

    // Filtrar por psicólogo específico
    if (psychologistId) {
      query = query.where('psychologistId', '==', psychologistId);
    }

    // Filtrar por categoría
    if (category) {
      query = query.where('category', '==', category);
    }

    // Ordenar resultados
    if (['createdAt', 'updatedAt', 'publishedAt', 'views', 'likes'].includes(orderBy)) {
      query = query.orderBy(orderBy, order);
    } else {
      query = query.orderBy('createdAt', 'desc');
    }

    // Paginación
    const limitNum = Math.min(parseInt(limit), 100);
    const offset = (parseInt(page) - 1) * limitNum;
    
    if (offset > 0) {
      query = query.limit(limitNum);
    } else {
      query = query.limit(limitNum);
    }

    const articlesSnapshot = await query.get();
    
    let articles = articlesSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        // Normalizar el estado si no existe
        status: data.status || (data.isPublished ? 'published' : 'draft'),
        createdAt: data.createdAt?.toDate(),
        updatedAt: data.updatedAt?.toDate(),
        publishedAt: data.publishedAt?.toDate(),
        deletedAt: data.deletedAt?.toDate()
      };
    });

    // Filtro de búsqueda 
    if (search) {
      const searchTerm = search.toLowerCase();
      articles = articles.filter(article => 
        article.title?.toLowerCase().includes(searchTerm) ||
        article.summary?.toLowerCase().includes(searchTerm) ||
        article.psychologistName?.toLowerCase().includes(searchTerm) ||
        article.tags?.some(tag => tag.includes(searchTerm))
      );
    }

    // Obtener estadísticas generales
    const totalQuery = db.collection('articles');
    const totalSnapshot = await totalQuery.get();
    const stats = {
      total: totalSnapshot.size,
      published: totalSnapshot.docs.filter(doc => {
        const data = doc.data();
        return data.status === 'published' || data.isPublished;
      }).length,
      draft: totalSnapshot.docs.filter(doc => {
        const data = doc.data();
        return data.status === 'draft' || (!data.isPublished && !data.status);
      }).length,
      archived: totalSnapshot.docs.filter(doc => doc.data().status === 'archived').length,
      deleted: totalSnapshot.docs.filter(doc => doc.data().status === 'deleted').length
    };

    res.json({
      articles,
      pagination: {
        currentPage: parseInt(page),
        limit: limitNum,
        totalResults: articles.length,
        hasNextPage: articles.length === limitNum
      },
      stats,
      filters: {
        status,
        category,
        psychologistId,
        search,
        orderBy,
        order
      }
    });

  } catch (error) {
    console.error(" Error obteniendo artículos para admin:", error);
    res.status(500).json({
      error: "Error al obtener artículos",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Obtener un artículo específico con detalles completos
adminArticleRouter.get("/articles/:articleId", async (req, res) => {
  try {
    // Verificar que es admin
    await verifyIsAdmin(req.userId);
  } catch (adminError) {
    return res.status(403).json({ error: adminError.message });
  }

  const { articleId } = req.params;

  try {
    const articleDoc = await db.collection('articles').doc(articleId).get();
    
    if (!articleDoc.exists) {
      return res.status(404).json({ error: "Artículo no encontrado" });
    }

    const articleData = articleDoc.data();
    
    // Obtener información del psicólogo
    let psychologistData = null;
    if (articleData.psychologistId) {
      const psychologistDoc = await db.collection('psychologists').doc(articleData.psychologistId).get();
      if (psychologistDoc.exists) {
        psychologistData = psychologistDoc.data();
      }
    }

    // Obtener likes del artículo
    const likesSnapshot = await db.collection('article_likes')
      .where('articleId', '==', articleId)
      .get();

    const article = {
      id: articleDoc.id,
      ...articleData,
      // Normalizar estado
      status: articleData.status || (articleData.isPublished ? 'published' : 'draft'),
      psychologist: psychologistData ? {
        id: articleData.psychologistId,
        name: psychologistData.name,
        email: psychologistData.email,
        specialization: psychologistData.specialization,
        isValidated: psychologistData.isValidated
      } : null,
      likesCount: likesSnapshot.size,
      createdAt: articleData.createdAt?.toDate(),
      updatedAt: articleData.updatedAt?.toDate(),
      publishedAt: articleData.publishedAt?.toDate(),
      deletedAt: articleData.deletedAt?.toDate()
    };

    res.json({ article });

  } catch (error) {
    console.error("Error obteniendo artículo:", error);
    res.status(500).json({
      error: "Error al obtener artículo",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Actualizar estado de un artículo (publicar/despublicar/archivar)
adminArticleRouter.put("/articles/:articleId/status", async (req, res) => {
  try {
    // Verificar que es admin
    await verifyIsAdmin(req.userId);
  } catch (adminError) {
    return res.status(403).json({ error: adminError.message });
  }

  const { articleId } = req.params;
  const { status, adminNote } = req.body;

  if (!['published', 'draft', 'archived', 'deleted'].includes(status)) {
    return res.status(400).json({
      error: "Estado inválido. Debe ser: published, draft, archived, o deleted"
    });
  }

  try {
    const articleDoc = await db.collection('articles').doc(articleId).get();
    
    if (!articleDoc.exists) {
      return res.status(404).json({ error: "Artículo no encontrado" });
    }

    const updateData = {
      status: status,
      updatedAt: FieldValue.serverTimestamp(),
      adminNote: adminNote || null
    };

    // Actualizar campos específicos según el estado
    if (status === 'published') {
      updateData.isPublished = true;
      if (!articleDoc.data().publishedAt) {
        updateData.publishedAt = FieldValue.serverTimestamp();
      }
    } else {
      updateData.isPublished = false;
    }

    if (status === 'deleted') {
      updateData.deletedAt = FieldValue.serverTimestamp();
    }

    await db.collection('articles').doc(articleId).update(updateData);
    
    res.json({
      success: true,
      message: `Artículo ${status === 'published' ? 'publicado' : 
                status === 'draft' ? 'marcado como borrador' :
                status === 'archived' ? 'archivado' : 'eliminado'} exitosamente`,
      articleId: articleId,
      newStatus: status
    });

  } catch (error) {
    console.error("Error actualizando estado del artículo:", error);
    res.status(500).json({
      error: "Error al actualizar estado del artículo",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Eliminar permanentemente un artículo (solo admins)
adminArticleRouter.delete("/articles/:articleId/permanent", async (req, res) => {
  try {
    // Verificar que es admin
    await verifyIsAdmin(req.userId);
  } catch (adminError) {
    return res.status(403).json({ error: adminError.message });
  }

  const { articleId } = req.params;
  const { confirmPermanentDelete } = req.body;

  if (!confirmPermanentDelete) {
    return res.status(400).json({
      error: "Debe confirmar la eliminación permanente"
    });
  }

  try {
    const articleDoc = await db.collection('articles').doc(articleId).get();
    
    if (!articleDoc.exists) {
      return res.status(404).json({ error: "Artículo no encontrado" });
    }

    const articleData = articleDoc.data();

    // Eliminar likes relacionados
    const likesSnapshot = await db.collection('article_likes')
      .where('articleId', '==', articleId)
      .get();

    const batch = db.batch();
    
    // Eliminar todos los likes
    likesSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    // Eliminar el artículo
    batch.delete(db.collection('articles').doc(articleId));

    if (articleData.psychologistId) {
      const psychologistRef = db.collection('psychologists').doc(articleData.psychologistId);
      batch.update(psychologistRef, {
        articlesCount: FieldValue.increment(-1)
      });
    }

    await batch.commit();

    console.log(`Artículo ${articleId} eliminado permanentemente`);
    
    res.json({
      success: true,
      message: "Artículo eliminado permanentemente"
    });

  } catch (error) {
    console.error("Error eliminando artículo permanentemente:", error);
    res.status(500).json({
      error: "Error al eliminar artículo permanentemente",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

export default adminArticleRouter;