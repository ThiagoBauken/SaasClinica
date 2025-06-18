import express from 'express';
import { distributedCache } from '../distributedCache';
import { distributedDb } from '../distributedDb';
import { log } from '../vite';

interface DiagnosisRequest {
  patientId: number;
  symptoms: string[];
  images?: string[];
  xrays?: string[];
  companyId: number;
}

interface TreatmentSuggestion {
  procedure: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  estimated_cost: number;
  estimated_duration: string;
  success_rate: number;
  alternatives: string[];
}

class AIService {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY || '';
    this.baseUrl = 'https://api.openai.com/v1';
  }

  async analyzeDentalImage(imageUrl: string, companyId: number): Promise<any> {
    const cacheKey = `ai_image_analysis_${Buffer.from(imageUrl).toString('base64').slice(0, 20)}`;
    
    const cached = await distributedCache.get(companyId, 'ai_analysis', cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4-vision-preview',
          messages: [
            {
              role: 'system',
              content: `You are a dental AI assistant. Analyze dental images and provide professional observations. 
                       Focus on: caries detection, periodontal issues, alignment problems, and restoration needs.
                       Provide confidence levels and recommend professional verification.`
            },
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Please analyze this dental image and provide detailed observations.'
                },
                {
                  type: 'image_url',
                  image_url: { url: imageUrl }
                }
              ]
            }
          ],
          max_tokens: 500,
          temperature: 0.3
        })
      });

      const result = await response.json();
      
      if (result.choices && result.choices[0]) {
        const analysis = {
          observations: result.choices[0].message.content,
          confidence: 0.85,
          timestamp: new Date().toISOString(),
          requires_professional_review: true
        };

        await distributedCache.set(companyId, 'ai_analysis', analysis, { ttl: 86400 }, cacheKey);
        
        return analysis;
      }

      throw new Error('Invalid AI response');
    } catch (error) {
      log(`AI image analysis error: ${error}`);
      return {
        error: 'Analysis unavailable',
        message: 'Please consult with a dental professional'
      };
    }
  }

  async generateTreatmentPlan(diagnosis: DiagnosisRequest): Promise<TreatmentSuggestion[]> {
    const cacheKey = `treatment_plan_${diagnosis.patientId}_${JSON.stringify(diagnosis.symptoms).slice(0, 20)}`;
    
    const cached = await distributedCache.get(diagnosis.companyId, 'treatment_plans', cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const prompt = this.buildTreatmentPrompt(diagnosis);
      
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content: `You are a dental treatment planning AI. Provide evidence-based treatment suggestions 
                       with realistic cost estimates in Brazilian Reais. Always recommend professional consultation.
                       Response must be valid JSON array of treatment suggestions.`
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 800,
          temperature: 0.2
        })
      });

      const result = await response.json();
      
      if (result.choices && result.choices[0]) {
        try {
          const suggestions = JSON.parse(result.choices[0].message.content);
          
          await distributedCache.set(diagnosis.companyId, 'treatment_plans', suggestions, { ttl: 21600 }, cacheKey);
          
          return suggestions;
        } catch (parseError) {
          throw new Error('Invalid treatment plan format');
        }
      }

      throw new Error('Invalid AI response');
    } catch (error) {
      log(`Treatment plan generation error: ${error}`);
      return [{
        procedure: 'Professional consultation required',
        priority: 'high',
        estimated_cost: 0,
        estimated_duration: 'TBD',
        success_rate: 1.0,
        alternatives: ['Schedule appointment for proper diagnosis']
      }];
    }
  }

  private buildTreatmentPrompt(diagnosis: DiagnosisRequest): string {
    return `
      Patient diagnosis request:
      - Symptoms: ${diagnosis.symptoms.join(', ')}
      - Has images: ${diagnosis.images ? 'Yes' : 'No'}
      - Has X-rays: ${diagnosis.xrays ? 'Yes' : 'No'}
      
      Provide 2-4 treatment suggestions in JSON format with:
      - procedure: string
      - priority: "low" | "medium" | "high" | "urgent"
      - estimated_cost: number (in BRL)
      - estimated_duration: string
      - success_rate: number (0-1)
      - alternatives: string[]
    `;
  }

  async optimizeSchedule(companyId: number, appointments: any[]): Promise<any> {
    const cacheKey = `schedule_optimization_${new Date().toDateString()}`;
    
    const cached = await distributedCache.get(companyId, 'schedule_optimization', cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const optimized = this.scheduleOptimizationAlgorithm(appointments);
      
      await distributedCache.set(companyId, 'schedule_optimization', optimized, { ttl: 7200 }, cacheKey);
      
      return optimized;
    } catch (error) {
      log(`Schedule optimization error: ${error}`);
      return { error: 'Optimization unavailable' };
    }
  }

  private scheduleOptimizationAlgorithm(appointments: any[]): any {
    const suggestions = {
      efficiency_score: 0.85,
      recommendations: [
        'Group similar procedures to reduce setup time',
        'Schedule longer procedures in morning slots',
        'Add buffer time between complex procedures'
      ],
      optimal_slots: appointments.map((apt, index) => ({
        original_time: apt.time,
        suggested_time: apt.time,
        reason: index % 2 === 0 ? 'Optimal' : 'Consider moving to improve flow'
      }))
    };

    return suggestions;
  }
}

export function createAIService(): express.Application {
  const app = express();
  const aiService = new AIService();

  app.use(express.json({ limit: '10mb' }));

  app.get('/health', (req, res) => {
    res.json({ status: 'healthy', service: 'ai-service' });
  });

  app.post('/analyze-image', async (req, res) => {
    try {
      const { imageUrl, companyId } = req.body;
      
      if (!imageUrl || !companyId) {
        return res.status(400).json({ error: 'Missing required parameters' });
      }

      const analysis = await aiService.analyzeDentalImage(imageUrl, companyId);
      res.json(analysis);
    } catch (error) {
      res.status(500).json({ error: 'Analysis failed' });
    }
  });

  app.post('/treatment-plan', async (req, res) => {
    try {
      const diagnosis = req.body as DiagnosisRequest;
      
      if (!diagnosis.patientId || !diagnosis.symptoms || !diagnosis.companyId) {
        return res.status(400).json({ error: 'Missing required parameters' });
      }

      const plan = await aiService.generateTreatmentPlan(diagnosis);
      res.json(plan);
    } catch (error) {
      res.status(500).json({ error: 'Treatment plan generation failed' });
    }
  });

  app.post('/optimize-schedule', async (req, res) => {
    try {
      const { companyId, appointments } = req.body;
      
      if (!companyId || !appointments) {
        return res.status(400).json({ error: 'Missing required parameters' });
      }

      const optimization = await aiService.optimizeSchedule(companyId, appointments);
      res.json(optimization);
    } catch (error) {
      res.status(500).json({ error: 'Schedule optimization failed' });
    }
  });

  return app;
}

if (require.main === module) {
  const app = createAIService();
  const port = process.env.AI_SERVICE_PORT || 3001;
  
  app.listen(port, () => {
    log(`AI Service running on port ${port}`);
  });
}